import type { SnapshotQuestion } from '@/db/repositories';
import type { ArucoDetection, ImageQuality, Point, RevisionDetection } from '@/wasm/openOmr.js';
import {
	bytesToUuid,
	getOpenOmr,
	imageDataToOpenOmrImage,
	openOmrImageToImageData,
} from '@/utils/openOmr';
import { i18n } from '@/lib/i18n.svelte';
import { buildQuestionResponseRows } from '@/utils/questionResponses';

export const SHEET_SIZE = { width: 1800, height: 2050 } as const;
export const ANSWER_CELL_SIZE = { width: 84, height: 84 } as const;
export const ANSWER_INNER_CELL_SIZE = { width: 42, height: 42 } as const;

export interface DebugPoint {
	x: number;
	y: number;
}

export interface DetectedArucoMarker {
	id: number;
	center: DebugPoint;
	corners: DebugPoint[];
}

export interface DetectedQrCode {
	data: string;
	metadata: { revisionId: string } | undefined;
	corners: DebugPoint[];
}

export interface GradingSheetScan {
	imageData: ImageData;
	normalizedImage: ImageData;
	markers: DetectedArucoMarker[];
	qrCode: DetectedQrCode;
	scannedAnswers: number[];
}

export type OmrDiagnosticStage =
	| 'module-loaded'
	| 'image-copied'
	| 'aruco-detected'
	| 'normalized'
	| 'revision-detected'
	| 'graded';

export interface GradingSheetDiagnostics {
	imageData: ImageData;
	markers: DetectedArucoMarker[];
	normalizedImage?: ImageData;
	qrCode: DetectedQrCode | null;
	scannedAnswers: number[] | null;
	quality: 'good' | 'too-dark' | 'too-bright';
	stages: OmrDiagnosticStage[];
	warnings: string[];
}

export interface OmrScanResult {
	scanStatus: 'success' | 'error';
	revisionId: string;
	testId: string;
	testName: string;
	revisionName: string;
	scannedAnswers: number[];
	correctAnswers: boolean[];
	correctAnswerIndices: number[];
	responseLabels: string[];
	score: number;
	totalQuestions: number;
	normalizedImage?: ImageData;
	error?: string;
}

export async function scanGradingSheetImage(file: File): Promise<GradingSheetScan> {
	const bitmap = await createImageBitmap(file);
	try {
		return await scanGradingSheetImageData(readImageBitmap(bitmap));
	} finally {
		bitmap.close();
	}
}

export async function scanGradingSheetImageData(imageData: ImageData): Promise<GradingSheetScan> {
	const diagnostics = await diagnoseGradingSheetImageData(imageData);
	if (!diagnostics.normalizedImage) throw new Error(diagnostics.warnings.at(-1));
	if (!diagnostics.qrCode) throw new Error(diagnostics.warnings.at(-1));
	if (!diagnostics.scannedAnswers) throw new Error(diagnostics.warnings.at(-1));
	return {
		imageData,
		normalizedImage: diagnostics.normalizedImage,
		markers: diagnostics.markers,
		qrCode: diagnostics.qrCode,
		scannedAnswers: diagnostics.scannedAnswers,
	};
}

export async function diagnoseGradingSheetImageData(
	imageData: ImageData
): Promise<GradingSheetDiagnostics> {
	const openOmr = await getOpenOmr();
	const stages: OmrDiagnosticStage[] = ['module-loaded'];
	const image = imageDataToOpenOmrImage(openOmr, imageData);
	stages.push('image-copied');
	const grader = new openOmr.SheetGrader();

	try {
		const qualityValue = openOmr.checkImageQuality(image);
		const quality = imageQualityName(openOmr, qualityValue);
		const detections = grader.detectAruco(image);
		let markers: DetectedArucoMarker[];
		try {
			markers = Array.from(detections, mapArucoDetection);
		} finally {
			detections.delete();
		}
		stages.push('aruco-detected');
		logDiagnostics('Wykryte markery ArUco', markers);

		if (markers.length < 3) {
			return diagnosticsFailure(imageData, markers, quality, stages, i18n.t('errors.markers'));
		}
		if (!grader.normalize(SHEET_SIZE)) {
			return diagnosticsFailure(
				imageData,
				markers,
				quality,
				stages,
				i18n.t('errors.normalization')
			);
		}
		stages.push('normalized');

		const normalized = grader.normalizedImage();
		let normalizedImage: ImageData;
		try {
			normalizedImage = openOmrImageToImageData(openOmr, normalized);
		} finally {
			normalized.data.delete();
		}

		const revision = grader.detectRevisionId();
		if (!revision) {
			return diagnosticsFailure(
				imageData,
				markers,
				quality,
				stages,
				i18n.t('errors.qr'),
				normalizedImage
			);
		}
		const qrCode = revisionToQrCode(revision);
		stages.push('revision-detected');

		const grades = grader.gradeSheet(ANSWER_CELL_SIZE, ANSWER_INNER_CELL_SIZE);
		try {
			stages.push('graded');
			const scannedAnswers = Array.from(grades, answerMaskToIndex);
			logDiagnostics('Wynik diagnostyki openOmr', { quality, stages, qrCode, scannedAnswers });
			return {
				imageData,
				normalizedImage,
				markers,
				qrCode,
				scannedAnswers,
				quality,
				stages,
				warnings: [],
			};
		} finally {
			grades.delete();
		}
	} finally {
		grader.delete();
		image.data.delete();
	}
}

function diagnosticsFailure(
	imageData: ImageData,
	markers: DetectedArucoMarker[],
	quality: GradingSheetDiagnostics['quality'],
	stages: OmrDiagnosticStage[],
	warning: string,
	normalizedImage?: ImageData
): GradingSheetDiagnostics {
	console.warn('[openOmr]', warning, { quality, stages, markers });
	return {
		imageData,
		markers,
		normalizedImage,
		qrCode: null,
		scannedAnswers: null,
		quality,
		stages,
		warnings: [warning],
	};
}

function imageQualityName(
	openOmr: Awaited<ReturnType<typeof getOpenOmr>>,
	quality: ImageQuality
): GradingSheetDiagnostics['quality'] {
	if (quality.value === openOmr.ImageQuality.TooDark.value) return 'too-dark';
	if (quality.value === openOmr.ImageQuality.TooBright.value) return 'too-bright';
	return 'good';
}

function logDiagnostics(label: string, value: unknown): void {
	console.info(`[openOmr] ${label}`, value);
}

export async function checkImageQuality(imageData: ImageData): Promise<ImageQuality> {
	const openOmr = await getOpenOmr();
	const image = imageDataToOpenOmrImage(openOmr, imageData);
	try {
		return openOmr.checkImageQuality(image);
	} finally {
		image.data.delete();
	}
}

export function computeScore(scannedAnswers: number[], revisionContent: SnapshotQuestion[]) {
	const responseRows = buildQuestionResponseRows(revisionContent);
	const correctAnswerIndices = responseRows.map((row) => row.correctAnswerIndex);
	const correctAnswers = correctAnswerIndices.map(
		(correctAnswer, index) => scannedAnswers[index] === correctAnswer
	);
	return {
		correctAnswers,
		correctAnswerIndices,
		responseLabels: responseRows.map((row) => row.displayNumber),
		score: correctAnswers.filter(Boolean).length,
		totalQuestions: responseRows.length,
	};
}

function readImageBitmap(bitmap: ImageBitmap): ImageData {
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error(i18n.t('errors.canvasContext'));
	context.drawImage(bitmap, 0, 0);
	return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

function mapArucoDetection(detection: ArucoDetection): DetectedArucoMarker {
	const corners = [detection.tl, detection.tr, detection.br, detection.bl];
	return { id: detection.id, corners, center: polygonCenter(corners) };
}

function revisionToQrCode(revision: RevisionDetection): DetectedQrCode {
	try {
		const revisionId = bytesToUuid(Uint8Array.from(revision.revisionId));
		return {
			data: revisionId,
			metadata: { revisionId },
			corners: [revision.tl, revision.tr, revision.br, revision.bl],
		};
	} finally {
		revision.revisionId.delete();
	}
}

function answerMaskToIndex(mask: number): number {
	if (mask === 0 || (mask & (mask - 1)) !== 0) return -1;
	return Math.log2(mask);
}

function polygonCenter(points: Point[]): DebugPoint {
	const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), {
		x: 0,
		y: 0,
	});
	return { x: sum.x / points.length, y: sum.y / points.length };
}
