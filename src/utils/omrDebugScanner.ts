import {
	arucoMarkerPlacements,
	gridArea,
	metadataQrPlacement,
	omrExclusionZones,
	omrVersionFromMarkerId,
	type ArucoMarkerPlacement,
	type OmrConfig,
	type OmrCorner,
	type OmrRect,
} from '@/utils/omr';

import {
	detectArucoMarkersInMat,
	detectQrCode,
	imageDataToGrayscaleMat,
	matToImageData,
	normalizeMat,
	readAnalysisImage,
	resolveOmrConfig,
	type DebugPoint,
	type DetectedArucoMarker,
	type DetectedQrCode,
} from '@/utils/omrScanner';
import { deleteOpenCvObject, getOpenCv } from '@/utils/opencv';

export type { DebugPoint, DetectedArucoMarker, DetectedQrCode };

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
	scannedAnswers: number[] | null;
}

export async function analyzeGradingSheetImage(file: File): Promise<GradingSheetDebugResult> {
	const image = await createImageBitmap(file);
	const { imageData, pointToSource } = readAnalysisImage(image);

	const cv = await getOpenCv();
	const grayMat = imageDataToGrayscaleMat(cv, imageData);

	let analysisMarkers: DetectedArucoMarker[];
	/* eslint-disable-next-line no-useless-assignment -- `omrConfig` is used in the "finally" block. */
	let omrConfig: OmrConfig = resolveOmrConfig([]);
	let normalizedImage: ImageData | undefined;
	let qrCodeInMarkedArea: DetectedQrCode | null = null;

	try {
		analysisMarkers = detectArucoMarkersInMat(cv, grayMat);
		omrConfig = resolveOmrConfig(analysisMarkers);
		const normalizedMat = normalizeMat(cv, omrConfig, grayMat, analysisMarkers);
		if (normalizedMat) {
			qrCodeInMarkedArea = await detectQrCode(cv, omrConfig, normalizedMat);
			normalizedImage = matToImageData(cv, normalizedMat);
			deleteOpenCvObject(normalizedMat);
		}
	} finally {
		deleteOpenCvObject(grayMat);
	}

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

function addExpectedMarkerMetadata(
	config: OmrConfig,
	markers: DetectedArucoMarker[]
): DetectedArucoMarker[] {
	const expectedPlacements = arucoMarkerPlacements(config);
	return markers.map((marker) => ({
		...marker,
		corner: marker.corner ?? findExpectedCorner(marker.id, expectedPlacements),
	}));
}

function findExpectedCorner(id: number, placements: ArucoMarkerPlacement[]): OmrCorner | undefined {
	return placements.find((placement) => placement.id === id)?.corner;
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
