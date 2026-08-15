/**
 * QR code generation, backed by the `qrcode` package.
 *
 * Uses the synchronous `QRCode.create` (pure JS, no canvas) so codes can be
 * rendered deterministically during print — no async gap where the browser
 * could print before a code has rendered.
 */
import QRCode from 'qrcode';

/**
 * Render a payload as an SVG QR code string.
 *
 * No quiet zone is included (`margin: 0` equivalent) — the surrounding layout
 * is responsible for keeping enough white space around the code. Dark modules
 * are merged into horizontal runs to keep the SVG small.
 */
export function qrCodeSvg(payload: string): string {
	const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
	const { size, data } = qr.modules;

	let path = '';
	for (let y = 0; y < size; y++) {
		let x = 0;
		while (x < size) {
			if (!data[y * size + x]) {
				x++;
				continue;
			}
			const start = x;
			while (x < size && data[y * size + x]) x++;
			path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
		}
	}

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
		`shape-rendering="crispEdges"><path fill="#000000" d="${path}"/></svg>`
	);
}
