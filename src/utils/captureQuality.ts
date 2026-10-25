export interface CaptureQuality {
	region: 'sheet' | 'frame';
	brightness: number;
	contrast: number;
	clipped: number;
	illuminationSpread: number;
	edgeStrength: number;
	dark: boolean;
	shadow?: boolean;
}

/** Fixed-cost luminance sampling. These are lighting heuristics, not a calibrated blur detector. */
export function measureCaptureQuality(
	image: ImageData,
	markers: { corners: { x: number; y: number }[] }[] = []
): CaptureQuality {
	const points = markers.flatMap((marker) => marker.corners);
	const sheet = markers.length >= 3;
	const left = sheet ? Math.max(0, Math.min(...points.map((point) => point.x))) : 0;
	const top = sheet ? Math.max(0, Math.min(...points.map((point) => point.y))) : 0;
	const right = sheet
		? Math.min(image.width, Math.max(...points.map((point) => point.x)))
		: image.width;
	const bottom = sheet
		? Math.min(image.height, Math.max(...points.map((point) => point.y)))
		: image.height;
	const histogram = new Uint32Array(256);
	const tiles = Array.from({ length: 16 }, () => [] as number[]);
	let clipped = 0;
	let edges = 0;
	for (let y = 0; y < 96; y++) {
		let previous = 0;
		for (let x = 0; x < 96; x++) {
			const px = Math.min(image.width - 1, Math.floor(left + ((x + 0.5) * (right - left)) / 96));
			const py = Math.min(image.height - 1, Math.floor(top + ((y + 0.5) * (bottom - top)) / 96));
			const offset = (py * image.width + px) * 4;
			const value = Math.round(
				0.2126 * image.data[offset] +
					0.7152 * image.data[offset + 1] +
					0.0722 * image.data[offset + 2]
			);
			histogram[value]++;
			tiles[Math.floor(y / 24) * 4 + Math.floor(x / 24)].push(value);
			if (value >= 250) clipped++;
			if (x > 0) edges += Math.abs(value - previous);
			previous = value;
		}
	}
	function percentile(fraction: number) {
		let count = 0;
		for (let value = 0; value < 256; value++) {
			count += histogram[value];
			if (count >= fraction * 96 * 96) return value;
		}
		return 255;
	}
	// Paper/background estimate per tile is less sensitive to sparse black printing than means.
	const backgrounds = tiles.map(
		(tile) => tile.sort((a, b) => a - b)[Math.floor(tile.length * 0.8)]
	);
	const brightness = percentile(0.8);
	const contrast = percentile(0.95) - percentile(0.05);
	return {
		region: sheet ? 'sheet' : 'frame',
		brightness,
		contrast,
		clipped: clipped / (96 * 96),
		illuminationSpread: Math.max(...backgrounds) - Math.min(...backgrounds),
		// Only infer shadow inside a located sheet, not across paper and a dark desk.
		shadow:
			sheet &&
			backgrounds.filter((value) => value < 140).length >= 2 &&
			Math.max(...backgrounds) - Math.min(...backgrounds) > 65,
		edgeStrength: edges / (96 * 95),
		// Whole-frame darkness must be extreme: a dark desk is not a dark sheet.
		dark: brightness < (sheet ? 125 : 65),
	};
}

/** A single, delayed lighting trial per session; manual control overrides automation. */
export function createLightingPolicy(now = performance.now()) {
	let settledAt = now + 1800;
	let darkFrames = 0;
	let attempted = false;
	let automatic = true;
	let baseline: CaptureQuality | undefined;
	let rollbackPending = false;
	return {
		manual() {
			automatic = false;
		},
		next(
			quality: CaptureQuality,
			readable: boolean,
			torch: boolean,
			time = performance.now()
		): boolean | undefined {
			if (!automatic || time < settledAt) return;
			if (rollbackPending && torch) return false;
			if (baseline && torch) {
				const comparable = quality.region === baseline.region;
				// Clipped white paper alone isn't glare. Roll back only when information also degrades.
				const washedOut =
					comparable &&
					quality.clipped > baseline.clipped + 0.2 &&
					quality.contrast < baseline.contrast * 0.75;
				const worseLighting =
					comparable &&
					quality.illuminationSpread > baseline.illuminationSpread + 45 &&
					quality.contrast < baseline.contrast;
				baseline = undefined;
				if (!readable && (washedOut || worseLighting)) {
					rollbackPending = true;
					return false;
				}
			}
			if (readable || torch || attempted) return;
			darkFrames = quality.dark || quality.shadow ? darkFrames + 1 : 0;
			if (darkFrames < 3) return;
			attempted = true;
			baseline = quality;
			return true;
		},
		applied(time = performance.now()) {
			settledAt = time + 1500;
		},
	};
}
