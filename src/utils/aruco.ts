/**
 * ArUco marker generation backed by the bundled OpenCV.js build.
 *
 * The answer sheet's corner markers come from OpenCV's DICT_ARUCO_ORIGINAL —
 * the exact dictionary the scanner detects with — so generation and detection
 * are guaranteed to agree. Markers are rendered from the raw pixel matrix
 * OpenCV produces, wrapped in a one-cell white quiet zone so they can be
 * placed flush against their layout coordinates without extra spacing. Vector
 * SVG output stays crisp at any print DPI.
 */
import { deleteOpenCvObject, getOpenCv } from '@/utils/opencv';

/** Data cells per marker side in the original ArUco dictionary. */
const DATA_CELLS = 5;

/** Black border cells OpenCV draws around the data (one per side). */
const BORDER_CELLS = 1;

/** Total marker grid OpenCV generates: border + data + border. */
const GRID_CELLS = DATA_CELLS + 2 * BORDER_CELLS;

/** White quiet-zone cells added around the marker before printing. */
const QUIET_CELLS = 1;

/** Final SVG grid: quiet zone + marker grid + quiet zone. */
const SVG_CELLS = GRID_CELLS + 2 * QUIET_CELLS;

const svgCache = new Map<number, string>();

/**
 * Render an ArUco marker as an SVG string.
 *
 * Resolves once OpenCV.js is loaded; results are cached per marker id.
 */
export async function arucoMarkerSvg(id: number): Promise<string> {
	const cached = svgCache.get(id);
	if (cached) return cached;

	const matrix = await generateMarkerMatrix(id);
	const svg = buildMarkerSvg(matrix);
	svgCache.set(id, svg);
	return svg;
}

async function generateMarkerMatrix(id: number): Promise<Uint8Array> {
	const cv = await getOpenCv();
	const dictionary = cv.getPredefinedDictionary(cv.DICT_ARUCO_ORIGINAL);
	const image = new cv.Mat();

	try {
		cv.generateImageMarker(dictionary, id, GRID_CELLS, image, BORDER_CELLS);
		return Uint8Array.from(image.data);
	} finally {
		// Only the generated image is owned by us. The dictionary from
		// getPredefinedDictionary is a shared predefined object — deleting it
		// would corrupt it for every other caller (the scanner never deletes
		// it either).
		deleteOpenCvObject(image);
	}
}

function buildMarkerSvg(matrix: Uint8Array): string {
	let cells = '';
	for (let y = 0; y < GRID_CELLS; y++) {
		for (let x = 0; x < GRID_CELLS; x++) {
			if (matrix[y * GRID_CELLS + x] !== 0) {
				cells +=
					'<rect x="' +
					(x + QUIET_CELLS) +
					'" y="' +
					(y + QUIET_CELLS) +
					'" width="1" height="1" fill="#ffffff"/>';
			}
		}
	}

	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
		SVG_CELLS +
		' ' +
		SVG_CELLS +
		'" shape-rendering="crispEdges">' +
		'<rect x="0" y="0" width="' +
		SVG_CELLS +
		'" height="' +
		SVG_CELLS +
		'" fill="#ffffff"/>' +
		'<rect x="' +
		QUIET_CELLS +
		'" y="' +
		QUIET_CELLS +
		'" width="' +
		GRID_CELLS +
		'" height="' +
		GRID_CELLS +
		'" fill="#000000"/>' +
		cells +
		'<' +
		'/svg>'
	);
}
