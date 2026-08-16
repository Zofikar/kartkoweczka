import { AR, CV } from 'js-aruco';
import jsQR from 'jsqr';
import {
	ANSWER_SHEET_FORMAT_VERSION,
	ARUCO_BOTTOM_RIGHT_ANCHOR_ID,
	ARUCO_MARKER_SIZE,
	ARUCO_TOP_LEFT_ANCHOR_ID,
	ARUCO_TOP_RIGHT_ANCHOR_ID,
	OMR_DESIGN_HEIGHT,
	OMR_DESIGN_WIDTH,
	answerSheetFormatVersionFromMarkerId,
	arucoMarkerPlacements,
	metadataQrPlacement,
	omrExclusionZones,
	type ArucoMarkerPlacement,
	type OmrCorner,
	type OmrRect,
} from '@/utils/omr';

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
	metadata: unknown;
	corners: DebugPoint[];
}

export interface NormalizedOverlayRect extends OmrRect {
	key: string;
	label: string;
	kind: 'marker' | 'qr' | 'grid' | 'exclusion';
}

export interface GradingSheetDebugResult {
	image: ImageBitmap;
	imageData: ImageData;
	arucoMarkers: DetectedArucoMarker[];
	qrCodeInMarkedArea: DetectedQrCode | null;
	qrCodeInSourceImage: DetectedQrCode | null;
	normalizedImage?: ImageData;
	overlayRects: NormalizedOverlayRect[];
	warnings: string[];
}

interface PointPair {
	source: DebugPoint;
	destination: DebugPoint;
}

type Homography = [number, number, number, number, number, number, number, number, number];

interface ArucoDetectionPass {
	kernelSize: number;
	threshold: number;
	minimumContourSize: number;
	minimumEdgeLength: number;
}

interface SheetMetadata {
	r?: unknown;
	f?: unknown;
}

const ARUCO_DETECTION_PASSES: ArucoDetectionPass[] = [
	{ kernelSize: 2, threshold: 7, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 2, threshold: 9, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 2, threshold: 5, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 2, threshold: 3, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 1, threshold: 7, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 3, threshold: 7, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 2, threshold: 11, minimumContourSize: 0.005, minimumEdgeLength: 3 },
	{ kernelSize: 2, threshold: 5, minimumContourSize: 0.02, minimumEdgeLength: 4 },
];

const ARUCO_DETECTION_SCALES = [1, 1.5, 2, 3] as const;
const MAX_ANALYSIS_DIMENSION = 1800;

export async function analyzeGradingSheetImage(file: File): Promise<GradingSheetDebugResult> {
	const image = await createImageBitmap(file);
	const { imageData, scaleToSource } = readAnalysisImageData(image);
	const analysisMarkers = detectArucoMarkers(imageData);
	const normalizedImage = normalizeImageIfPossible(imageData, analysisMarkers);
	const qrCodeInMarkedArea = normalizedImage ? detectQrCode(normalizedImage) : null;
	const qrCodeInSourceImage = scaleQrCode(detectQrCode(imageData), scaleToSource);
	const arucoMarkers = analysisMarkers.map((marker) => scaleDetectedMarker(marker, scaleToSource));
	const markersWithExpectedMetadata = addExpectedMarkerMetadata(arucoMarkers);

	return {
		image,
		imageData,
		arucoMarkers: markersWithExpectedMetadata,
		qrCodeInMarkedArea,
		qrCodeInSourceImage,
		normalizedImage,
		overlayRects: buildOverlayRects(),
		warnings: buildWarnings(
			markersWithExpectedMetadata,
			qrCodeInMarkedArea,
			qrCodeInSourceImage,
			normalizedImage,
			readQrFormatVersion(qrCodeInMarkedArea, qrCodeInSourceImage)
		),
	};
}

function readAnalysisImageData(image: ImageBitmap): {
	imageData: ImageData;
	scaleToSource: number;
} {
	const analysisScale = Math.min(1, MAX_ANALYSIS_DIMENSION / Math.max(image.width, image.height));
	const width = Math.max(1, Math.round(image.width * analysisScale));
	const height = Math.max(1, Math.round(image.height * analysisScale));
	const canvas = new OffscreenCanvas(width, height);
	const context = getOffscreenCanvasContext(canvas);
	context.drawImage(image, 0, 0, width, height);
	return {
		imageData: context.getImageData(0, 0, width, height),
		scaleToSource: 1 / analysisScale,
	};
}

function getOffscreenCanvasContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('Nie można utworzyć kontekstu canvas 2D.');
	return context;
}

function detectQrCode(imageData: ImageData): DetectedQrCode | null {
	const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
	if (!qrCode) return null;

	return {
		data: qrCode.data,
		metadata: parseQrMetadata(qrCode.data),
		corners: [
			qrCode.location.topLeftCorner,
			qrCode.location.topRightCorner,
			qrCode.location.bottomRightCorner,
			qrCode.location.bottomLeftCorner,
		],
	};
}

function parseQrMetadata(data: string): unknown {
	try {
		return JSON.parse(data);
	} catch {
		return data;
	}
}

function readQrFormatVersion(
	markedAreaQrCode: DetectedQrCode | null,
	sourceQrCode: DetectedQrCode | null
): number | undefined {
	return readFormatVersion(markedAreaQrCode?.metadata) ?? readFormatVersion(sourceQrCode?.metadata);
}

function readFormatVersion(metadata: unknown): number | undefined {
	if (!metadata || typeof metadata !== 'object') return undefined;
	const formatVersion = (metadata as SheetMetadata).f;
	return typeof formatVersion === 'number' ? formatVersion : undefined;
}

function detectArucoMarkers(imageData: ImageData): DetectedArucoMarker[] {
	const markers = detectOriginalArucoMarkers(imageData).map((marker) => ({
		id: marker.id,
		center: polygonCenter(marker.corners),
		corners: marker.corners.map(copyPoint),
	}));
	return assignCornersByGeometry(markers);
}

function addExpectedMarkerMetadata(markers: DetectedArucoMarker[]): DetectedArucoMarker[] {
	const expectedPlacements = arucoMarkerPlacements();
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

function detectOriginalArucoMarkers(imageData: ImageData) {
	let markers: ReturnType<AR.Detector['detect']> = [];

	for (const scale of detectionScalesFor(imageData)) {
		markers = uniqueMarkersByPosition([
			...markers,
			...detectOriginalArucoMarkersAtScale(imageData, scale),
		]);
		if (markers.length >= 4) return markers;
	}

	return markers;
}

function detectionScalesFor(imageData: ImageData): readonly number[] {
	const longestSide = Math.max(imageData.width, imageData.height);
	if (longestSide >= 1600) return [1, 1.5];
	if (longestSide >= 1200) return [1, 1.5, 2];
	return ARUCO_DETECTION_SCALES;
}

function detectOriginalArucoMarkersAtScale(imageData: ImageData, scale: number) {
	const scaledImageData = scale === 1 ? imageData : scaleImageData(imageData, scale);
	let markers: ReturnType<AR.Detector['detect']> = [];

	for (const pass of ARUCO_DETECTION_PASSES) {
		markers = uniqueMarkersByPosition([
			...markers,
			...detectOriginalArucoMarkersWithPass(scaledImageData, pass),
		]);
		if (markers.length >= 4) break;
	}

	return scale === 1 ? markers : markers.map((marker) => scaleMarker(marker, 1 / scale));
}

function detectOriginalArucoMarkersWithPass(imageData: ImageData, pass: ArucoDetectionPass) {
	const detector = new AR.Detector();
	CV.grayscale(imageData, detector.grey);
	CV.adaptiveThreshold(detector.grey, detector.thres, pass.kernelSize, pass.threshold);

	detector.contours = CV.findContours(detector.thres, detector.binary);
	detector.candidates = detector.findCandidates(
		detector.contours,
		imageData.width * pass.minimumContourSize,
		0.05,
		pass.minimumEdgeLength
	);
	detector.candidates = detector.clockwiseCorners(detector.candidates);
	detector.candidates = detector.notTooNear(detector.candidates, 10);

	return detector.findMarkers(detector.grey, detector.candidates, 49);
}

function scaleImageData(imageData: ImageData, scale: number): ImageData {
	const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
	const sourceContext = getOffscreenCanvasContext(sourceCanvas);
	sourceContext.putImageData(imageData, 0, 0);

	const scaledCanvas = new OffscreenCanvas(
		Math.round(imageData.width * scale),
		Math.round(imageData.height * scale)
	);
	const scaledContext = getOffscreenCanvasContext(scaledCanvas);
	scaledContext.imageSmoothingEnabled = false;
	scaledContext.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
	return scaledContext.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
}

function scaleMarker(
	marker: ReturnType<AR.Detector['detect']>[number],
	scale: number
): ReturnType<AR.Detector['detect']>[number] {
	return {
		id: marker.id,
		corners: marker.corners.map((corner) => ({ x: corner.x * scale, y: corner.y * scale })),
	};
}

function scaleDetectedMarker(marker: DetectedArucoMarker, scale: number): DetectedArucoMarker {
	return {
		...marker,
		center: { x: marker.center.x * scale, y: marker.center.y * scale },
		corners: marker.corners.map((corner) => ({ x: corner.x * scale, y: corner.y * scale })),
	};
}

function scaleQrCode(qrCode: DetectedQrCode | null, scale: number): DetectedQrCode | null {
	if (!qrCode || scale === 1) return qrCode;
	return {
		...qrCode,
		corners: qrCode.corners.map((corner) => ({ x: corner.x * scale, y: corner.y * scale })),
	};
}

function uniqueMarkersByPosition(
	markers: ReturnType<AR.Detector['detect']>
): ReturnType<AR.Detector['detect']> {
	return markers.reduce<ReturnType<AR.Detector['detect']>>((uniqueMarkers, marker) => {
		const center = polygonCenter(marker.corners);
		const duplicate = uniqueMarkers.some((existingMarker) => {
			const existingCenter = polygonCenter(existingMarker.corners);
			return existingMarker.id === marker.id && distance(existingCenter, center) < 12;
		});
		return duplicate ? uniqueMarkers : [...uniqueMarkers, marker];
	}, []);
}

function distance(left: DebugPoint, right: DebugPoint): number {
	return Math.hypot(left.x - right.x, left.y - right.y);
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

function normalizeImageIfPossible(
	imageData: ImageData,
	markers: DetectedArucoMarker[]
): ImageData | undefined {
	const pointPairs = findNormalizationPointPairs(markers);
	if (pointPairs.length !== 4) return undefined;

	const homography = calculateHomography(pointPairs);
	return warpImage(imageData, homography, OMR_DESIGN_WIDTH, OMR_DESIGN_HEIGHT);
}

function findNormalizationPointPairs(markers: DetectedArucoMarker[]): PointPair[] {
	const geometryPairs = pointPairsFromDetectedCorners(markers);
	if (geometryPairs.length === 4) return geometryPairs;
	const knownIdPairs = findPointPairsByKnownMarkerIds(markers);
	if (knownIdPairs.length === 4) return knownIdPairs;
	return findPointPairsByGeometry(markers);
}

function pointPairsFromDetectedCorners(markers: DetectedArucoMarker[]): PointPair[] {
	const markersByCorner = new Map<OmrCorner, DetectedArucoMarker>();
	for (const marker of markers) {
		if (marker.corner) markersByCorner.set(marker.corner, marker);
	}
	return pointPairsFromCornerMap(markersByCorner);
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

function findPointPairsByKnownMarkerIds(markers: DetectedArucoMarker[]): PointPair[] {
	const markersByCorner = new Map<OmrCorner, DetectedArucoMarker>();
	for (const marker of markers) assignKnownMarkerCorner(markersByCorner, marker);
	assignUnknownBottomLeftMarker(markersByCorner, markers);
	return pointPairsFromCornerMap(markersByCorner);
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
	markersByCorner: Map<OmrCorner, DetectedArucoMarker>
): PointPair[] {
	return (['tl', 'tr', 'br', 'bl'] as const).flatMap((corner) => {
		const marker = markersByCorner.get(corner);
		const placement = findCanonicalPlacement(corner);
		return marker ? [{ source: marker.center, destination: markerCenter(placement) }] : [];
	});
}

function findCanonicalPlacement(corner: OmrCorner): ArucoMarkerPlacement {
	const placement = arucoMarkerPlacements().find((marker) => marker.corner === corner);
	if (!placement) throw new Error(`Brak kanonicznego położenia markera ${corner}.`);
	return placement;
}

function findKnownCorner(id: number): OmrCorner | undefined {
	if (id === ARUCO_TOP_LEFT_ANCHOR_ID) return 'tl';
	if (id === ARUCO_TOP_RIGHT_ANCHOR_ID) return 'tr';
	if (id === ARUCO_BOTTOM_RIGHT_ANCHOR_ID) return 'br';
	if (answerSheetFormatVersionFromMarkerId(id) !== undefined) return 'bl';
	return undefined;
}

function findPointPairsByGeometry(markers: DetectedArucoMarker[]): PointPair[] {
	if (markers.length < 4) return [];
	const orderedMarkers = orderMarkersByPosition(markers);
	const destinations = canonicalMarkerCenters();
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

function canonicalMarkerCenters(): DebugPoint[] {
	return arucoMarkerPlacements().map(markerCenter);
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

function buildOverlayRects(): NormalizedOverlayRect[] {
	return [
		{
			key: 'grid',
			label: 'Grid',
			kind: 'grid',
			x: 0,
			y: 0,
			width: OMR_DESIGN_WIDTH,
			height: OMR_DESIGN_HEIGHT,
		},
		...arucoMarkerPlacements().map(markerOverlayRect),
		...omrExclusionZones().map((zone) => ({
			...zone,
			key: `exclusion-${zone.key}`,
			kind: 'exclusion' as const,
		})),
		{ key: 'metadata-qr', label: 'QR metadata', kind: 'qr', ...metadataQrPlacement() },
	];
}

function markerOverlayRect(marker: ArucoMarkerPlacement): NormalizedOverlayRect {
	return {
		key: `marker-${marker.corner}`,
		label: `${marker.corner.toUpperCase()} #${marker.id}`,
		kind: 'marker',
		x: marker.x,
		y: marker.y,
		width: ARUCO_MARKER_SIZE,
		height: ARUCO_MARKER_SIZE,
	};
}

function buildWarnings(
	markers: DetectedArucoMarker[],
	qrCodeInMarkedArea: DetectedQrCode | null,
	qrCodeInSourceImage: DetectedQrCode | null,
	normalizedImage: ImageData | undefined,
	qrFormatVersion: number | undefined
): string[] {
	const markerFormatVersion = readMarkerFormatVersion(markers);
	return [
		...(markers.length < 4
			? [`Wykryto ${markers.length} marker(y) ArUco; normalizacja wymaga 4.`]
			: []),
		...(qrCodeInMarkedArea ? [] : ['Nie wykryto QR w obszarze oznaczonym markerami ArUco.']),
		...(qrCodeInSourceImage ? [] : ['Nie wykryto QR w obrazie źródłowym.']),
		...(normalizedImage ? [] : ['Podgląd znormalizowanej karty jest niedostępny.']),
		...(markerFormatVersion === undefined ? ['Nie wykryto markera wersji formatu karty.'] : []),
		...(markerFormatVersion !== undefined && markerFormatVersion !== ANSWER_SHEET_FORMAT_VERSION
			? [`Marker wskazuje nieobsługiwany format karty v${markerFormatVersion}.`]
			: []),
		...(markerFormatVersion !== undefined &&
		qrFormatVersion !== undefined &&
		markerFormatVersion !== qrFormatVersion
			? [`Niezgodna wersja formatu: marker v${markerFormatVersion}, QR v${qrFormatVersion}.`]
			: []),
	];
}

function readMarkerFormatVersion(markers: DetectedArucoMarker[]): number | undefined {
	const versionMarker = markers.find((marker) => marker.corner === 'bl');
	return versionMarker ? answerSheetFormatVersionFromMarkerId(versionMarker.id) : undefined;
}

export function drawImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Nie można utworzyć kontekstu canvas 2D.');
	context.putImageData(imageData, 0, 0);
}

export { OMR_DESIGN_HEIGHT, OMR_DESIGN_WIDTH };
