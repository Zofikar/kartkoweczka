/**
 * Shared OpenCV.js loader.
 *
 * The app bundles a custom minimal OpenCV.js build (see `opencv-setup/`) that
 * includes only the modules the scanner and sheet renderer need: ArUco
 * detection/generation, QR detection/generation, and the few image ops used
 * to prepare frames. This module is the single entry point that loads that
 * build and hands out the `cv` namespace, so detection and generation share
 * one wasm instance and one script tag.
 */
import type { OpenCv, OpenCvDeletable } from '@/types/opencv';

let cvPromise: Promise<OpenCv> | undefined;

function getBaseAssetUrl(path: string): string {
	return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/** Load the bundled OpenCV.js build once and reuse it for every caller. */
export function getOpenCv(): Promise<OpenCv> {
	cvPromise ??= loadOpenCv();
	return cvPromise;
}

async function loadOpenCv(): Promise<OpenCv> {
	const script = document.createElement('script');
	script.src = getBaseAssetUrl('opencv/opencv.js');
	script.async = true;

	const loaded = new Promise<void>((resolve, reject) => {
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
	});

	document.head.appendChild(script);
	await loaded;

	const cv = (
		globalThis as typeof globalThis & {
			cv?: OpenCv | Promise<OpenCv>;
		}
	).cv;

	if (!cv) {
		throw new Error('OpenCV.js loaded but cv was not initialized');
	}

	return await cv;
}

/** Release a native OpenCV object if one was created. */
export function deleteOpenCvObject(object: OpenCvDeletable | undefined): void {
	object?.delete?.();
}
