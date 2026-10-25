import type { Locale } from '@/lib/i18n.svelte';
import type { GradingSheetDiagnostics } from './omrScanner';
import type { CaptureQuality } from './captureQuality';
import { getRevisionAnswerCounts } from './omrScanner';

export interface LiveDetection {
	diagnostics: GradingSheetDiagnostics;
	quality: CaptureQuality;
	duration: number;
	timings: Record<string, number>;
}

/** Single in-flight frame, no queue. Stop terminates even synchronous WASM work. */
export function createLiveDetector() {
	let worker: Worker | undefined;
	let pending:
		{ resolve: (value: LiveDetection | null) => void; reject: (error: Error) => void } | undefined;
	let generation = 0;
	let canvas: OffscreenCanvas | undefined;

	function preload(locale: Locale) {
		worker ??= new Worker(new URL('./liveDetector.worker.ts', import.meta.url), { type: 'module' });
		worker.postMessage({ preload: true, locale });
	}

	function stop(force = false) {
		generation++;
		// Keep an idle preloaded worker across camera setup; terminate active work.
		if (!pending && !force) {
			canvas = undefined;
			return;
		}
		worker?.terminate();
		worker = undefined;
		pending?.resolve(null);
		pending = undefined;
		canvas = undefined;
	}

	async function analyze(
		video: HTMLVideoElement,
		locale: Locale,
		debugImages = false
	): Promise<LiveDetection | null> {
		if (pending) return null;
		const session = generation;
		// Native frame reaches WASM; only marker discovery is reduced there.
		const width = video.videoWidth;
		const height = video.videoHeight;
		canvas ??= new OffscreenCanvas(width, height);
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		canvas.getContext('2d')!.drawImage(video, 0, 0, width, height);
		const bitmap = canvas.transferToImageBitmap();
		if (session !== generation) {
			bitmap.close();
			return null;
		}
		worker ??= new Worker(new URL('./liveDetector.worker.ts', import.meta.url), { type: 'module' });
		return new Promise((resolve, reject) => {
			pending = { resolve, reject };
			const activeWorker = worker!;
			worker!.onmessage = (
				event: MessageEvent<LiveDetection | { error: string } | { revisionId: string }>
			) => {
				if ('revisionId' in event.data) {
					void getRevisionAnswerCounts(event.data.revisionId).then(
						(answerCounts) => {
							if (session === generation) activeWorker.postMessage({ answerCounts });
						},
						(error: unknown) => {
							if (session === generation)
								activeWorker.postMessage({
									answerCountsError: error instanceof Error ? error.message : String(error),
								});
						}
					);
					return;
				}
				const current = pending;
				pending = undefined;
				if ('error' in event.data) current?.reject(new Error(event.data.error));
				else {
					current?.resolve(event.data);
				}
			};
			worker!.onerror = (event) => {
				pending?.reject(new Error(event.message));
				pending = undefined;
				stop(true);
			};
			try {
				worker!.postMessage({ bitmap, locale, debugImages }, [bitmap]);
			} catch (error) {
				bitmap.close();
				pending = undefined;
				reject(error);
				stop(true);
			}
		});
	}

	return { analyze, stop, preload };
}
