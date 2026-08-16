/**
 * ArUco marker generation, backed by the `aruco-marker` package.
 *
 * Markers come from the original ArUco dictionary (5×5 data cells, marker
 * ids 0–1023) — detectable by OpenCV's DICT_ARUCO_ORIGINAL, which the scanner
 * uses with the very same dictionary.
 *
 * The package provides the marker bit matrices; the SVG is rendered here so
 * the output includes the black border *and* a one-cell white quiet zone
 * (the package's own SVG omits the quiet zone).
 */
import { arucoMarkerMatrix } from 'aruco-marker';

/** Data cells per marker side in the original ArUco dictionary. */
const DATA_CELLS = 5;

/** Total SVG grid: quiet zone + border + data + border + quiet zone. */
const GRID_CELLS = DATA_CELLS + 4;

const svgCache = new Map<number, string>();

/**
 * Render an ArUco marker as an SVG string.
 *
 * The SVG viewBox includes a one-cell white quiet zone around the marker, so
 * markers can be placed flush against their layout coordinates without extra
 * spacing. Vector output stays crisp at any print DPI.
 */
export function arucoMarkerSvg(id: number): string {
	let svg = svgCache.get(id);
	if (!svg) {
		svg = buildMarkerSvg(id);
		svgCache.set(id, svg);
	}
	return svg;
}

function buildMarkerSvg(id: number): string {
	// matrix[column][row], 1 = white cell — same orientation as the package's
	// own SVG renderer.
	const matrix = arucoMarkerMatrix(id);

	let cells = '';
	for (let y = 0; y < DATA_CELLS; y++) {
		for (let x = 0; x < DATA_CELLS; x++) {
			if (matrix[x][y] === 1) {
				cells += `<rect x="${x + 2}" y="${y + 2}" width="1" height="1" fill="#ffffff"/>`;
			}
		}
	}

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_CELLS} ${GRID_CELLS}" ` +
		`shape-rendering="crispEdges">` +
		`<rect x="0" y="0" width="${GRID_CELLS}" height="${GRID_CELLS}" fill="#ffffff"/>` +
		`<rect x="1" y="1" width="${GRID_CELLS - 2}" height="${GRID_CELLS - 2}" fill="#000000"/>` +
		cells +
		`</svg>`
	);
}
