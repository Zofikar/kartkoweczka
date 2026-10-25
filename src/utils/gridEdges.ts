export interface GridEdge {
	axis: 'top' | 'left';
	expected: number;
	points: { x: number; y: number }[];
	line: { x: number; y: number }[];
	offset: number;
	tiltDegrees: number;
	rms: number;
	coverage: number;
}

/** Diagnostic only: coherent line hypotheses require three borders at canonical cell spacing. */
export function collectGridEdges(image: ImageData): GridEdge[] {
	const sx = image.width / 1800;
	const sy = image.height / 2050;
	const result: GridEdge[] = [];
	const luminance = (x: number, y: number) => {
		const index = (Math.round(y) * image.width + Math.round(x)) * 4;
		return (image.data[index] + image.data[index + 1] + image.data[index + 2]) / 3;
	};
	for (const axis of ['top', 'left'] as const) {
		const horizontal = axis === 'top';
		const expected = horizontal ? 232 * sy : 70 * sx;
		const start = horizontal ? 80 * sx : 242 * sy;
		// Search only the guaranteed first two cells; block widths/heights vary by sheet.
		const end = horizontal ? 228 * sx : 390 * sy;
		const radius = Math.max(3, Math.round(28 * (horizontal ? sy : sx)));
		const step = 84 * (horizontal ? sy : sx);
		const alongs = Array.from({ length: 32 }, (_, i) => start + ((end - start) * i) / 31);
		function evidence(along: number, across: number) {
			const x = horizontal ? along : across;
			const y = horizontal ? across : along;
			if (x < 7 || y < 7 || x >= image.width - 7 || y >= image.height - 7) return 0;
			let darkest = 255;
			for (let d = -2; d <= 2; d++)
				darkest = Math.min(darkest, luminance(horizontal ? x : x + d, horizontal ? y + d : y));
			const background = horizontal
				? (luminance(x, y - 7) + luminance(x, y + 7)) / 2
				: (luminance(x - 7, y) + luminance(x + 7, y)) / 2;
			return Math.max(0, background - darkest);
		}
		const middle = (start + end) / 2;
		let bestScore = 0;
		let bestPosition = expected;
		let bestSlope = 0;
		// Fit coherent hypotheses rather than independently choosing strong text pixels.
		for (let offset = -radius; offset <= radius; offset += 2) {
			for (let tilt = -0.12; tilt <= 0.1201; tilt += 0.02) {
				// A candidate one cell from a clipped boundary cannot be identified as outer.
				if (expected + offset - step < 7 && expected + offset > step - 7) continue;
				const supports = [0, 1, 2].map(
					(index) =>
						alongs.filter(
							(along) =>
								evidence(along, expected + offset + tilt * (along - middle) + index * step) >= 18
						).length / 32
				);
				if (supports[0] < 0.65 || supports[1] < 0.6 || supports[2] < 0.6) continue;
				// A parallel border on the outside means this may be an internal separator.
				const outside =
					alongs.filter(
						(along) => evidence(along, expected + offset + tilt * (along - middle) - step) >= 18
					).length / 32;
				if (outside > 0.4) continue;
				const score =
					Math.min(...supports) - Math.abs(offset) / (radius * 20) - Math.abs(tilt) * 0.1;
				if (score > bestScore) {
					bestScore = score;
					bestPosition = expected + offset;
					bestSlope = tilt;
				}
			}
		}
		if (!bestScore) continue;
		const points: { x: number; y: number }[] = [];
		for (const along of alongs) {
			const predicted = bestPosition + bestSlope * (along - middle);
			let position = predicted;
			let strongest = 0;
			for (let d = -3; d <= 3; d++) {
				const score = evidence(along, predicted + d);
				if (
					score > strongest ||
					(score === strongest && Math.abs(d) < Math.abs(position - predicted))
				) {
					strongest = score;
					position = predicted + d;
				}
			}
			if (strongest >= 18)
				points.push(horizontal ? { x: along, y: position } : { x: position, y: along });
		}
		if (points.length < 16) continue;
		const u = (p: { x: number; y: number }) => (horizontal ? p.x : p.y);
		const v = (p: { x: number; y: number }) => (horizontal ? p.y : p.x);
		const meanU = points.reduce((sum, p) => sum + u(p), 0) / points.length;
		const meanV = points.reduce((sum, p) => sum + v(p), 0) / points.length;
		const denominator = points.reduce((sum, p) => sum + (u(p) - meanU) ** 2, 0);
		if (!denominator) continue;
		const slope = points.reduce((sum, p) => sum + (u(p) - meanU) * (v(p) - meanV), 0) / denominator;
		const predict = (along: number) => meanV + slope * (along - meanU);
		const rms = Math.sqrt(
			points.reduce((sum, p) => sum + (v(p) - predict(u(p))) ** 2, 0) / points.length
		);
		if (rms > 6 * (horizontal ? sy : sx)) continue;
		result.push({
			axis,
			expected,
			points,
			line: [start, end].map((along) =>
				horizontal ? { x: along, y: predict(along) } : { x: predict(along), y: along }
			),
			offset: meanV - expected,
			tiltDegrees: (Math.atan(slope) * 180) / Math.PI,
			rms,
			coverage: points.length / 32,
		});
	}
	return result;
}
