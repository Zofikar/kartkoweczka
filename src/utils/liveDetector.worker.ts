import { diagnoseGradingSheetImageData } from './omrScanner';
import { measureCaptureQuality } from './captureQuality';
import { i18n, type Locale } from '@/lib/i18n.svelte';
import { getOpenOmr, imageDataToOpenOmrImage } from './openOmr';

let canvas: OffscreenCanvas | undefined;
self.onmessage = async (
	event: MessageEvent<{
		bitmap?: ImageBitmap;
		locale: Locale;
		preload?: boolean;
		debugImages?: boolean;
	}>
) => {
	const { bitmap, locale } = event.data;
	if (event.data.preload) {
		try {
			await getOpenOmr();
		} catch (error) {
			console.warn('Camera WASM preload failed', error);
		}
		return;
	}
	if (!bitmap) return;
	try {
		const started = performance.now();
		i18n.locale = locale;
		canvas ??= new OffscreenCanvas(bitmap.width, bitmap.height);
		if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
		if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
		const context = canvas.getContext('2d', { willReadFrequently: true })!;
		context.drawImage(bitmap, 0, 0);
		const frame = context.getImageData(0, 0, canvas.width, canvas.height);
		const timings: Record<string, number> = { readback: Math.round(performance.now() - started) };
		const diagnostics = await diagnoseGradingSheetImageData(frame, {
			includeNormalizedImage: event.data.debugImages === true,
			checkExposure: false,
			onTiming: (stage, milliseconds) => {
				timings[stage] = milliseconds;
			},
		});
		const quality = measureCaptureQuality(frame, diagnostics.markers);
		// Fresh detection in the final warp, not source corners projected by their own fit.
		if (event.data.debugImages && diagnostics.normalizedImage) {
			const module = await getOpenOmr();
			const image = imageDataToOpenOmrImage(module, diagnostics.normalizedImage);
			const grader = new module.SheetGrader();
			try {
				const markers = grader.detectAruco(image);
				try {
					diagnostics.normalizedMarkers = Array.from(markers, (marker) => ({
						id: marker.id,
						corners: [marker.tl, marker.tr, marker.br, marker.bl],
						center: {
							x: (marker.tl.x + marker.tr.x + marker.br.x + marker.bl.x) / 4,
							y: (marker.tl.y + marker.tr.y + marker.br.y + marker.bl.y) / 4,
						},
					}));
				} finally {
					markers.delete();
				}
			} finally {
				grader.delete();
				image.data.delete();
			}
		}
		diagnostics.quality = quality.dark ? 'too-dark' : 'good';
		const transfer: Transferable[] = [frame.data.buffer];
		if (diagnostics.normalizedImage) transfer.push(diagnostics.normalizedImage.data.buffer);
		self.postMessage(
			{ diagnostics, quality, timings, duration: Math.round(performance.now() - started) },
			{ transfer }
		);
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : String(error) });
	} finally {
		bitmap.close();
	}
};
