import {
	arucoMarkerPlacements,
	gridArea,
	LATEST_OMR_CONFIG,
	metadataQrPlacement,
	OMR_CONFIG_VERSIONS,
	omrConfigForVersion,
	omrExclusionZones,
	omrVersionFromMarkerId,
	type ArucoMarkerPlacement,
	type OmrConfig,
	type OmrCorner,
	type OmrRect,
	type SheetMetadata,
} from '@/utils/omr';

import type { OpenCv, Mat, MatVector, aruco_DetectorParameters } from '@/types/opencv';
import { deleteOpenCvObject, getOpenCv } from '@/utils/opencv';

/** Extra design units around the known metadata QR position to search in. */
const QR_SEARCH_SAFETY_MARGIN = 80;

export interface DebugPoint {
	x: number;
	y: number;
}

export interface DetectedArucoMarker {
	id: number;
	corner?: OmrCorner;
	center: DebugPoint;
	corners: DebugPoint[];
}

export interface DetectedQrCode {
	data: string;
	/** Decoded sheet metadata, or `undefined` for a non-metadata QR payload. */
	metadata: SheetMetadata | undefined;
	corners: DebugPoint[];
}

export interface NormalizedOverlayRect extends OmrRect {
	key: string;
	kind: 'marker' | 'qr' | 'grid' | 'exclusion';
}

export interface GradingSheetDebugResult {
	image: ImageBitmap;
	imageData: ImageData;
	arucoMarkers: DetectedArucoMarker[];
	qrCodeInMarkedArea: DetectedQrCode | null;
	normalizedImage?: ImageData;
	overlayRects: NormalizedOverlayRect[];
	warnings: string[];
	/** Answer indices selected per question, or `null` when scan data isn't yet available. */
	scannedAnswers: number[] | null;
}

interface PointPair {
	source: DebugPoint;
	destination: DebugPoint;
}

type Homography = [number, number, number, number, number, number, number, number, number];

interface OriginalArucoMarker {
	id: number;
	corners: DebugPoint[];
}

interface AnalysisImage {
	imageData: ImageData;
	pointToSource: (point: DebugPoint) => DebugPoint;
}

/**
 * Marker ids a sheet may legitimately contain: anchors and version markers of
 * every known format version, so detection stays backwards compatible.
 */
const VALID_ANSWER_SHEET_MARKER_IDS = new Set<number>(
	OMR_CONFIG_VERSIONS.flatMap((config) => [
		config.aruco.anchorIds.topLeft,
		config.aruco.anchorIds.topRight,
		config.aruco.anchorIds.bottomRight,
		...config.aruco.formatVersionIds,
	])
);

export async function analyzeGradingSheetImage(file: File): Promise<GradingSheetDebugResult> {
	const image = await createImageBitmap(file);
	const { imageData, pointToSource } = readAnalysisImage(image);
	const analysisMarkers = await detectArucoMarkers(imageData);
	const omrConfig = resolveOmrConfig(analysisMarkers);
	const normalizedImage = normalizeImageIfPossible(omrConfig, imageData, analysisMarkers);
	const qrCodeInMarkedArea = normalizedImage
		? await detectQrCode(omrConfig, normalizedImage)
		: null;
	const arucoMarkers = analysisMarkers.map((marker) => mapMarkerPoints(marker, pointToSource));
	const markersWithExpectedMetadata = addExpectedMarkerMetadata(omrConfig, arucoMarkers);

	return {
		image,
		imageData,
		arucoMarkers: markersWithExpectedMetadata,
		qrCodeInMarkedArea,
		normalizedImage,
		overlayRects: buildOverlayRects(omrConfig),
		warnings: buildWarnings(markersWithExpectedMetadata, qrCodeInMarkedArea, normalizedImage),
		scannedAnswers: null,
	};
}

/**
 * Resolve the OMR config for the detected sheet from its bottom-left version
 * marker. Falls back to the latest known config when no version marker was
 * detected (e.g. fewer than four markers).
 */
function resolveOmrConfig(markers: Omit<DetectedArucoMarker, 'corner'>[]): OmrConfig {
	const versionMarker = markers.find((marker) =>
		LATEST_OMR_CONFIG.aruco.formatVersionIds.some((id) => id === marker.id)
	);
	const version = versionMarker ? omrVersionFromMarkerId(versionMarker.id) : undefined;
	return version === undefined ? LATEST_OMR_CONFIG : omrConfigForVersion(version);
}

function readAnalysisImage(image: ImageBitmap): AnalysisImage {
	const isLandscape = image.width > image.height;
	const portraitWidth = isLandscape ? image.height : image.width;
	const portraitHeight = isLandscape ? image.width : image.height;
	const width = portraitWidth;
	const height = portraitHeight;
	const canvas = new OffscreenCanvas(width, height);
	const context = getOffscreenCanvasContext(canvas);
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	drawPortraitImage(context, image, width, height, isLandscape);
	return {
		imageData: context.getImageData(0, 0, width, height),
		pointToSource: isLandscape
			? (point) => mapRotatedPointToSource(point, image, width, height)
			: (point) => mapPortraitPointToSource(point, image, width, height),
	};
}

function drawPortraitImage(
	context: OffscreenCanvasRenderingContext2D,
	image: ImageBitmap,
	width: number,
	height: number,
	isLandscape: boolean
): void {
	if (!isLandscape) {
		context.drawImage(image, 0, 0, width, height);
		return;
	}
	context.translate(width, 0);
	context.rotate(Math.PI / 2);
	context.drawImage(image, 0, 0, height, width);
}

function mapPortraitPointToSource(
	point: DebugPoint,
	image: ImageBitmap,
	analysisWidth: number,
	analysisHeight: number
): DebugPoint {
	return {
		x: (point.x * image.width) / analysisWidth,
		y: (point.y * image.height) / analysisHeight,
	};
}

function mapRotatedPointToSource(
	point: DebugPoint,
	image: ImageBitmap,
	analysisWidth: number,
	analysisHeight: number
): DebugPoint {
	return {
		x: (point.y * image.width) / analysisHeight,
		y: image.height - (point.x * image.height) / analysisWidth,
	};
}

function getOffscreenCanvasContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('Nie można utworzyć kontekstu canvas 2D.');
	return context;
}

async function detectQrCode(
	config: OmrConfig,
	imageData: ImageData
): Promise<DetectedQrCode | null> {
	const cv = await getOpenCv();
	const searchRect = expandRect(metadataQrPlacement(config), QR_SEARCH_SAFETY_MARGIN, {
		width: config.geometry.designWidth,
		height: config.geometry.designHeight,
	});
	const cropped = cropImageData(imageData, searchRect);
	const source = cv.matFromImageData(cropped);
	const grayscale = new cv.Mat();
	const points = new cv.Mat();
	const detector = new cv.QRCodeDetectorAruco();

	try {
		cv.cvtColor(source, grayscale, cv.COLOR_RGBA2GRAY);
		const data = detector.detectAndDecode(grayscale, points);
		if (!data) return null;
		const corners = readQrCorners(points);
		if (!corners) return null;
		return {
			data,
			metadata: config.qrCode.decodePayload(data),
			corners: corners.map((corner) => ({
				x: corner.x + searchRect.x,
				y: corner.y + searchRect.y,
			})),
		};
	} catch {
		return null;
	} finally {
		deleteOpenCvObject(detector);
		deleteOpenCvObject(points);
		deleteOpenCvObject(grayscale);
		deleteOpenCvObject(source);
	}
}

async function detectArucoMarkers(imageData: ImageData): Promise<DetectedArucoMarker[]> {
	const markers = (await detectOriginalArucoMarkers(imageData)).map((marker) => ({
		id: marker.id,
		center: polygonCenter(marker.corners),
		corners: marker.corners.map(copyPoint),
	}));
	return assignCornersByGeometry(markers);
}

function addExpectedMarkerMetadata(
	config: OmrConfig,
	markers: DetectedArucoMarker[]
): DetectedArucoMarker[] {
	const expectedPlacements = arucoMarkerPlacements(config);
	return markers.map((marker) => ({
		...marker,
		corner:
			marker.corner ??
			findExpectedCorner(marker.id, expectedPlacements) ??
			findKnownCorner(marker.id),
	}));
}

function assignCornersByGeometry(
	markers: Omit<DetectedArucoMarker, 'corner'>[]
): DetectedArucoMarker[] {
	if (markers.length < 4) return markers;

	const orientation = estimateSheetOrientation(markers);
	const orderedMarkers = orderMarkersByArucoOrientation(markers, orientation);
	const corners: OmrCorner[] = ['tl', 'tr', 'br', 'bl'];
	const cornerByMarker = new Map<DetectedArucoMarker, OmrCorner>();

	for (const [index, marker] of orderedMarkers.entries()) {
		cornerByMarker.set(marker, corners[index]);
	}

	return markers.map((marker) => ({ ...marker, corner: cornerByMarker.get(marker) }));
}

async function detectOriginalArucoMarkers(imageData: ImageData): Promise<OriginalArucoMarker[]> {
	return detectOriginalArucoMarkersInImageData(imageData);
}

async function detectOriginalArucoMarkersInImageData(
	imageData: ImageData
): Promise<OriginalArucoMarker[]> {
	const cv = await getOpenCv();
	const source = cv.matFromImageData(imageData);
	const grayscale = new cv.Mat();

	try {
		cv.cvtColor(source, grayscale, cv.COLOR_RGBA2GRAY);
		return detectOriginalArucoMarkersInGrayscaleImage(cv, grayscale);
	} finally {
		deleteOpenCvObject(grayscale);
		deleteOpenCvObject(source);
	}
}

function detectOriginalArucoMarkersInGrayscaleImage(cv: OpenCv, image: Mat): OriginalArucoMarker[] {
	const corners = new cv.MatVector();
	const rejected = new cv.MatVector();
	const ids = new cv.Mat();
	const parameters = buildArucoDetectorParameters(cv);
	const refineParameters = new cv.aruco_RefineParameters(10, 3, true);
	const detector = new cv.aruco_ArucoDetector(
		cv.getPredefinedDictionary(cv.DICT_ARUCO_ORIGINAL),
		parameters,
		refineParameters
	);

	try {
		detector.detectMarkers(image, corners, ids, rejected);
		return readDetectedArucoMarkers(corners as unknown as MatVector, ids);
	} finally {
		deleteOpenCvObject(detector);
		deleteOpenCvObject(refineParameters);
		deleteOpenCvObject(parameters);
		deleteOpenCvObject(ids);
		deleteOpenCvObject(corners);
	}
}

function buildArucoDetectorParameters(cv: OpenCv): aruco_DetectorParameters {
	const parameters = new cv.aruco_DetectorParameters();
	parameters.minMarkerPerimeterRate = 0.01;
	parameters.cornerRefinementMethod = cv.CORNER_REFINE_SUBPIX;
	parameters.cornerRefinementMaxIterations = 50;
	parameters.errorCorrectionRate = 0.8;
	parameters.minOtsuStdDev = 2;
	parameters.perspectiveRemovePixelPerCell = 8;
	parameters.useAruco3Detection = false;
	parameters.adaptiveThreshWinSizeMin = 3;
	parameters.adaptiveThreshWinSizeMax = 71;
	parameters.adaptiveThreshWinSizeStep = 5;
	return parameters;
}

function readDetectedArucoMarkers(corners: MatVector, ids: Mat): OriginalArucoMarker[] {
	const markerCount = Math.min(ids.data32S.length, corners.size());

	return Array.from({ length: markerCount }).flatMap((_, index) => {
		const id = ids.data32S[index];

		if (!VALID_ANSWER_SHEET_MARKER_IDS.has(id)) {
			return [];
		}

		const markerCorners = readMarkerCorners(corners.get(index));

		return markerCorners.length === 4 ? [{ id, corners: markerCorners }] : [];
	});
}

function readMarkerCorners(corners: Mat | undefined): DebugPoint[] {
	if (!corners?.data32F || corners.data32F.length < 8) return [];
	try {
		return Array.from({ length: 4 }, (_, index) => ({
			x: corners.data32F[index * 2],
			y: corners.data32F[index * 2 + 1],
		}));
	} finally {
		deleteOpenCvObject(corners);
	}
}

function mapMarkerPoints(
	marker: DetectedArucoMarker,
	mapPoint: (point: DebugPoint) => DebugPoint
): DetectedArucoMarker {
	return {
		...marker,
		center: mapPoint(marker.center),
		corners: marker.corners.map(mapPoint),
	};
}

function findExpectedCorner(id: number, placements: ArucoMarkerPlacement[]): OmrCorner | undefined {
	return placements.find((placement) => placement.id === id)?.corner;
}

function polygonCenter(points: DebugPoint[]): DebugPoint {
	const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), {
		x: 0,
		y: 0,
	});
	return { x: sum.x / points.length, y: sum.y / points.length };
}

function copyPoint(point: DebugPoint): DebugPoint {
	return { x: point.x, y: point.y };
}

function expandRect(
	rect: OmrRect,
	margin: number,
	bounds: { width: number; height: number }
): OmrRect {
	const left = Math.max(0, rect.x - margin);
	const top = Math.max(0, rect.y - margin);
	return {
		x: left,
		y: top,
		width: Math.min(bounds.width, rect.x + rect.width + margin) - left,
		height: Math.min(bounds.height, rect.y + rect.height + margin) - top,
	};
}

function cropImageData(image: ImageData, rect: OmrRect): ImageData {
	const width = Math.round(rect.width);
	const height = Math.round(rect.height);
	const cropped = new ImageData(width, height);
	const originX = Math.round(rect.x);
	const originY = Math.round(rect.y);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcX = originX + x;
			const srcY = originY + y;
			if (srcX < 0 || srcY < 0 || srcX >= image.width || srcY >= image.height) continue;
			const srcIndex = (srcY * image.width + srcX) * 4;
			const dstIndex = (y * width + x) * 4;
			cropped.data[dstIndex] = image.data[srcIndex];
			cropped.data[dstIndex + 1] = image.data[srcIndex + 1];
			cropped.data[dstIndex + 2] = image.data[srcIndex + 2];
			cropped.data[dstIndex + 3] = 255;
		}
	}
	return cropped;
}

function readQrCorners(points: Mat | undefined): DebugPoint[] | undefined {
	if (!points?.data32F || points.data32F.length < 8) return undefined;
	return Array.from({ length: 4 }, (_, index) => ({
		x: points.data32F[index * 2],
		y: points.data32F[index * 2 + 1],
	}));
}

function normalizeImageIfPossible(
	config: OmrConfig,
	imageData: ImageData,
	markers: DetectedArucoMarker[]
): ImageData | undefined {
	const pointPairs = findNormalizationPointPairs(config, markers);
	if (pointPairs.length !== 4) return undefined;

	const homography = calculateHomography(pointPairs);
	return warpImage(
		imageData,
		homography,
		config.geometry.designWidth,
		config.geometry.designHeight
	);
}

function findNormalizationPointPairs(
	config: OmrConfig,
	markers: DetectedArucoMarker[]
): PointPair[] {
	const geometryPairs = pointPairsFromDetectedCorners(config, markers);
	if (geometryPairs.length === 4) return geometryPairs;
	const knownIdPairs = findPointPairsByKnownMarkerIds(config, markers);
	if (knownIdPairs.length === 4) return knownIdPairs;
	return findPointPairsByGeometry(config, markers);
}

function pointPairsFromDetectedCorners(
	config: OmrConfig,
	markers: DetectedArucoMarker[]
): PointPair[] {
	const markersByCorner = new Map<OmrCorner, DetectedArucoMarker>();
	for (const marker of markers) {
		if (marker.corner) markersByCorner.set(marker.corner, marker);
	}
	return pointPairsFromCornerMap(config, markersByCorner);
}

function estimateSheetOrientation(markers: DetectedArucoMarker[]): {
	xAxis: DebugPoint;
	yAxis: DebugPoint;
} {
	return {
		xAxis: normalizeVector(sumMarkerAxis(markers, 0, 1)),
		yAxis: normalizeVector(sumMarkerAxis(markers, 0, 3)),
	};
}

function sumMarkerAxis(
	markers: DetectedArucoMarker[],
	fromCorner: number,
	toCorner: number
): DebugPoint {
	return markers.reduce(
		(sum, marker) => ({
			x: sum.x + marker.corners[toCorner].x - marker.corners[fromCorner].x,
			y: sum.y + marker.corners[toCorner].y - marker.corners[fromCorner].y,
		}),
		{ x: 0, y: 0 }
	);
}

function normalizeVector(vector: DebugPoint): DebugPoint {
	const length = Math.hypot(vector.x, vector.y);
	return length > Number.EPSILON ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 };
}

function orderMarkersByArucoOrientation(
	markers: DetectedArucoMarker[],
	orientation: { xAxis: DebugPoint; yAxis: DebugPoint }
): DetectedArucoMarker[] {
	const candidates = largestMarkers(markers);
	const [topLeft, bottomRight] = minMaxBy(candidates, (marker) =>
		sheetDiagonalProjection(marker, orientation)
	);
	const [bottomLeft, topRight] = minMaxBy(candidates, (marker) =>
		sheetAntiDiagonalProjection(marker, orientation)
	);
	return [topLeft, topRight, bottomRight, bottomLeft];
}

function sheetDiagonalProjection(
	marker: DetectedArucoMarker,
	orientation: { xAxis: DebugPoint; yAxis: DebugPoint }
): number {
	return dot(marker.center, orientation.xAxis) + dot(marker.center, orientation.yAxis);
}

function sheetAntiDiagonalProjection(
	marker: DetectedArucoMarker,
	orientation: { xAxis: DebugPoint; yAxis: DebugPoint }
): number {
	return dot(marker.center, orientation.xAxis) - dot(marker.center, orientation.yAxis);
}

function dot(point: DebugPoint, vector: DebugPoint): number {
	return point.x * vector.x + point.y * vector.y;
}

function findPointPairsByKnownMarkerIds(
	config: OmrConfig,
	markers: DetectedArucoMarker[]
): PointPair[] {
	const markersByCorner = new Map<OmrCorner, DetectedArucoMarker>();
	for (const marker of markers) assignKnownMarkerCorner(markersByCorner, marker);
	assignUnknownBottomLeftMarker(markersByCorner, markers);
	return pointPairsFromCornerMap(config, markersByCorner);
}

function assignKnownMarkerCorner(
	markersByCorner: Map<OmrCorner, DetectedArucoMarker>,
	marker: DetectedArucoMarker
): void {
	const corner = findKnownCorner(marker.id);
	if (corner) markersByCorner.set(corner, marker);
}

function assignUnknownBottomLeftMarker(
	markersByCorner: Map<OmrCorner, DetectedArucoMarker>,
	markers: DetectedArucoMarker[]
): void {
	if (markersByCorner.size !== 3 || markersByCorner.has('bl')) return;
	const unknownMarker = markers.find((marker) => !findKnownCorner(marker.id));
	if (unknownMarker) markersByCorner.set('bl', unknownMarker);
}

function pointPairsFromCornerMap(
	config: OmrConfig,
	markersByCorner: Map<OmrCorner, DetectedArucoMarker>
): PointPair[] {
	return (['tl', 'tr', 'br', 'bl'] as const).flatMap((corner) => {
		const marker = markersByCorner.get(corner);
		const placement = findCanonicalPlacement(config, corner);
		return marker ? [{ source: marker.center, destination: markerCenter(placement) }] : [];
	});
}

function findCanonicalPlacement(config: OmrConfig, corner: OmrCorner): ArucoMarkerPlacement {
	const placement = arucoMarkerPlacements(config).find((marker) => marker.corner === corner);
	if (!placement) throw new Error(`Brak kanonicznego położenia markera ${corner}.`);
	return placement;
}

function findKnownCorner(id: number): OmrCorner | undefined {
	for (const config of OMR_CONFIG_VERSIONS) {
		if (id === config.aruco.anchorIds.topLeft) return 'tl';
		if (id === config.aruco.anchorIds.topRight) return 'tr';
		if (id === config.aruco.anchorIds.bottomRight) return 'br';
	}
	if (omrVersionFromMarkerId(id) !== undefined) return 'bl';
	return undefined;
}

function findPointPairsByGeometry(config: OmrConfig, markers: DetectedArucoMarker[]): PointPair[] {
	if (markers.length < 4) return [];
	const orderedMarkers = orderMarkersByPosition(markers);
	const destinations = canonicalMarkerCenters(config);
	return orderedMarkers.map((marker, index) => ({
		source: marker.center,
		destination: destinations[index],
	}));
}

function orderMarkersByPosition(markers: DetectedArucoMarker[]): DetectedArucoMarker[] {
	const candidates = largestMarkers(markers);
	const [topLeft, bottomRight] = minMaxBy(
		candidates,
		(marker) => marker.center.x + marker.center.y
	);
	const [topRight, bottomLeft] = minMaxBy(
		candidates,
		(marker) => marker.center.x - marker.center.y
	);
	return [topLeft, topRight, bottomRight, bottomLeft];
}

function largestMarkers(markers: DetectedArucoMarker[]): DetectedArucoMarker[] {
	return [...markers].sort((left, right) => markerArea(right) - markerArea(left)).slice(0, 4);
}

function markerArea(marker: DetectedArucoMarker): number {
	const signedArea = marker.corners.reduce((sum, point, index) => {
		const next = marker.corners[(index + 1) % marker.corners.length];
		return sum + point.x * next.y - next.x * point.y;
	}, 0);
	return Math.abs(signedArea / 2);
}

function minMaxBy<T>(items: T[], selector: (item: T) => number): [T, T] {
	return [
		items.reduce((best, item) => (selector(item) < selector(best) ? item : best)),
		items.reduce((best, item) => (selector(item) > selector(best) ? item : best)),
	];
}

function canonicalMarkerCenters(config: OmrConfig): DebugPoint[] {
	return arucoMarkerPlacements(config).map(markerCenter);
}

function markerCenter(rect: OmrRect): DebugPoint {
	return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function calculateHomography(pointPairs: PointPair[]): Homography {
	const matrix = buildLinearSystem(pointPairs);
	const solution = solveLinearSystem(matrix);
	return [
		solution[0],
		solution[1],
		solution[2],
		solution[3],
		solution[4],
		solution[5],
		solution[6],
		solution[7],
		1,
	];
}

function buildLinearSystem(pointPairs: PointPair[]): number[][] {
	return pointPairs.flatMap(({ source, destination }) => [
		[
			destination.x,
			destination.y,
			1,
			0,
			0,
			0,
			-source.x * destination.x,
			-source.x * destination.y,
			source.x,
		],
		[
			0,
			0,
			0,
			destination.x,
			destination.y,
			1,
			-source.y * destination.x,
			-source.y * destination.y,
			source.y,
		],
	]);
}

function solveLinearSystem(matrix: number[][]): number[] {
	const rowCount = matrix.length;
	for (let column = 0; column < rowCount; column++) {
		pivotRows(matrix, column);
		normalizePivotRow(matrix, column);
		eliminateColumn(matrix, column);
	}
	return matrix.map((row) => row[rowCount]);
}

function pivotRows(matrix: number[][], column: number): void {
	let pivot = column;
	for (let row = column + 1; row < matrix.length; row++) {
		if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
	}
	if (Math.abs(matrix[pivot][column]) < Number.EPSILON)
		throw new Error('Markery są zdegenerowane.');
	[matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
}

function normalizePivotRow(matrix: number[][], column: number): void {
	const divisor = matrix[column][column];
	for (let cell = column; cell < matrix[column].length; cell++) matrix[column][cell] /= divisor;
}

function eliminateColumn(matrix: number[][], column: number): void {
	for (let row = 0; row < matrix.length; row++) {
		if (row !== column) eliminateRow(matrix, row, column);
	}
}

function eliminateRow(matrix: number[][], row: number, column: number): void {
	const factor = matrix[row][column];
	for (let cell = column; cell < matrix[row].length; cell++)
		matrix[row][cell] -= factor * matrix[column][cell];
}

function warpImage(
	source: ImageData,
	homography: Homography,
	width: number,
	height: number
): ImageData {
	const normalized = new ImageData(width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) copyWarpedPixel(source, normalized, homography, x, y);
	}
	return normalized;
}

function copyWarpedPixel(
	source: ImageData,
	destination: ImageData,
	homography: Homography,
	x: number,
	y: number
): void {
	const sourcePoint = applyHomography(homography, x, y);
	const sourceIndex = nearestPixelIndex(source, sourcePoint);
	const destinationIndex = (y * destination.width + x) * 4;
	if (sourceIndex === undefined) {
		writeTransparentPixel(destination, destinationIndex);
		return;
	}
	copyPixel(source.data, sourceIndex, destination.data, destinationIndex);
}

function applyHomography(homography: Homography, x: number, y: number): DebugPoint {
	const scale = homography[6] * x + homography[7] * y + homography[8];
	return {
		x: (homography[0] * x + homography[1] * y + homography[2]) / scale,
		y: (homography[3] * x + homography[4] * y + homography[5]) / scale,
	};
}

function nearestPixelIndex(image: ImageData, point: DebugPoint): number | undefined {
	const x = Math.round(point.x);
	const y = Math.round(point.y);
	if (x < 0 || y < 0 || x >= image.width || y >= image.height) return undefined;
	return (y * image.width + x) * 4;
}

function writeTransparentPixel(image: ImageData, index: number): void {
	image.data[index + 3] = 0;
}

function copyPixel(
	source: Uint8ClampedArray,
	sourceIndex: number,
	destination: Uint8ClampedArray,
	destinationIndex: number
): void {
	destination[destinationIndex] = source[sourceIndex];
	destination[destinationIndex + 1] = source[sourceIndex + 1];
	destination[destinationIndex + 2] = source[sourceIndex + 2];
	destination[destinationIndex + 3] = 255;
}

function buildOverlayRects(config: OmrConfig): NormalizedOverlayRect[] {
	return [
		{ key: 'grid', kind: 'grid', ...gridArea(config) },
		...arucoMarkerPlacements(config).map((marker) => markerOverlayRect(config, marker)),
		...omrExclusionZones(config).map((zone) => ({
			...zone,
			key: `exclusion-${zone.key}`,
			kind: 'exclusion' as const,
		})),
		{ key: 'metadata-qr', kind: 'qr', ...metadataQrPlacement(config) },
	];
}

function markerOverlayRect(config: OmrConfig, marker: ArucoMarkerPlacement): NormalizedOverlayRect {
	return {
		key: `marker-${marker.corner}`,
		kind: 'marker',
		x: marker.x,
		y: marker.y,
		width: config.aruco.markerSize,
		height: config.aruco.markerSize,
	};
}

function buildWarnings(
	markers: DetectedArucoMarker[],
	qrCodeInMarkedArea: DetectedQrCode | null,
	normalizedImage: ImageData | undefined
): string[] {
	const markerFormatVersion = readMarkerFormatVersion(markers);
	const hasVersionMarker = markers.some((marker) => marker.corner === 'bl');
	return [
		...(markers.length < 4
			? [`Wykryto ${markers.length} marker(y) ArUco; normalizacja wymaga 4.`]
			: []),
		...(qrCodeInMarkedArea ? [] : ['Nie wykryto QR w obszarze oznaczonym markerami ArUco.']),
		...(normalizedImage ? [] : ['Podgląd znormalizowanej karty jest niedostępny.']),
		...(hasVersionMarker && markerFormatVersion === undefined
			? ['Marker wersji karty wskazuje nieobsługiwany format.']
			: []),
		...(!hasVersionMarker ? ['Nie wykryto markera wersji formatu karty.'] : []),
	];
}

function readMarkerFormatVersion(markers: DetectedArucoMarker[]): number | undefined {
	const versionMarker = markers.find((marker) => marker.corner === 'bl');
	return versionMarker ? omrVersionFromMarkerId(versionMarker.id) : undefined;
}

export function drawImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Nie można utworzyć kontekstu canvas 2D.');
	context.putImageData(imageData, 0, 0);
}
