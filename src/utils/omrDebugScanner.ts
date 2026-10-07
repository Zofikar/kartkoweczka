import {
	diagnoseGradingSheetImageData,
	type DebugPoint,
	type DetectedArucoMarker,
	type DetectedQrCode,
	type NormalizedDetectionRect,
} from '@/utils/omrScanner';
import { i18n } from '@/lib/i18n.svelte';

export type { DebugPoint, DetectedArucoMarker, DetectedQrCode };

export interface NormalizedOverlayRect extends NormalizedDetectionRect {
	key: string;
}

export interface GradingSheetDebugResult {
	alignmentDetails?: string;
	image: ImageBitmap;
	imageData: ImageData;
	arucoMarkers: DetectedArucoMarker[];
	qrCodeInMarkedArea: DetectedQrCode | null;
	normalizedImage?: ImageData;
	overlayRects: NormalizedOverlayRect[];
	warnings: string[];
	scannedAnswers: number[] | null;
	quality: 'good' | 'too-dark' | 'too-bright';
	stages: string[];
}

export async function analyzeGradingSheetImage(file: File): Promise<GradingSheetDebugResult> {
	const image = await createImageBitmap(file);
	const imageData = readImageBitmap(image);
	const scan = await diagnoseGradingSheetImageData(imageData);
	return {
		alignmentDetails: scan.alignmentDetails,
		image,
		imageData,
		arucoMarkers: scan.markers,
		qrCodeInMarkedArea: scan.qrCode,
		normalizedImage: scan.normalizedImage,
		overlayRects: (scan.overlayRects ?? []).map((rect, index) => ({
			...rect,
			key: `overlay-${index}`,
		})),
		warnings: scan.warnings,
		scannedAnswers: scan.scannedAnswers,
		quality: scan.quality,
		stages: scan.stages,
	};
}

function readImageBitmap(image: ImageBitmap): ImageData {
	const canvas = new OffscreenCanvas(image.width, image.height);
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error(i18n.t('errors.canvasContext'));
	context.drawImage(image, 0, 0);
	return context.getImageData(0, 0, image.width, image.height);
}

export function drawImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error(i18n.t('errors.canvasContext'));
	context.putImageData(imageData, 0, 0);
}
