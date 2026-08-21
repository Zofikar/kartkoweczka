/**
 * QR code generation backed by the bundled OpenCV.js build.
 *
 * Uses OpenCV's QRCodeEncoder (exposed through the custom `encodeQRCode`
 * shim) so the printed metadata code is produced by the exact same library
 * that later decodes it. OpenCV always wraps the code in a 4-module quiet
 * zone; that border is trimmed here because the surrounding layout is
 * responsible for keeping white space around the code — matching the previous
 * `qrcode`-package output. Dark modules are merged into horizontal runs to
 * keep the SVG small.
 */
import { deleteOpenCvObject, getOpenCv } from '@/utils/opencv';
import type { Mat } from '@/types/opencv';

/** Quiet-zone modules OpenCV's QR encoder adds around every code. */
const QR_QUIET_ZONE = 4;

const svgCache = new Map<string, string>();

/**
 * Render a payload as an SVG QR code string.
 *
 * Resolves once OpenCV.js is loaded; results are cached per payload.
 */
export async function qrCodeSvg(payload: string): Promise<string> {
	const cached = svgCache.get(payload);
	if (cached) return cached;

	const svg = await buildQrSvg(payload);
	svgCache.set(payload, svg);
	return svg;
}

async function buildQrSvg(payload: string): Promise<string> {
	const cv = await getOpenCv();
	const image = cv.encodeQRCode(payload, cv.QRCodeEncoder_CORRECT_LEVEL_M);

	try {
		return buildSvgFromMatrix(readQrMatrix(image));
	} finally {
		deleteOpenCvObject(image);
	}
}

function readQrMatrix(image: Mat): boolean[][] {
	const size = image.rows;
	const data = image.data;
	const inner = size - 2 * QR_QUIET_ZONE;
	const matrix: boolean[][] = [];

	for (let y = 0; y < inner; y++) {
		const row: boolean[] = [];
		for (let x = 0; x < inner; x++) {
			row.push(data[(y + QR_QUIET_ZONE) * size + (x + QR_QUIET_ZONE)] === 0);
		}
		matrix.push(row);
	}
	return matrix;
}

function buildSvgFromMatrix(matrix: boolean[][]): string {
	const size = matrix.length;
	let path = '';

	for (let y = 0; y < size; y++) {
		const row = matrix[y];
		let x = 0;
		while (x < size) {
			if (!row[x]) {
				x++;
				continue;
			}
			const start = x;
			while (x < size && row[x]) x++;
			path += 'M' + start + ' ' + y + 'h' + (x - start) + 'v1h-' + (x - start) + 'z';
		}
	}

	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
		size +
		' ' +
		size +
		'" shape-rendering="crispEdges"><path fill="#000000" d="' +
		path +
		'"/>' +
		'<' +
		'/svg>'
	);
}
