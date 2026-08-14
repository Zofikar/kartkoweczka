/**
 * Print layout constants and helpers for A4 test sheets.
 *
 * All physical sizes are expressed in millimetres so they map 1:1 to CSS and
 * stay independent of screen DPI. Print body text uses a battle-tested serif
 * (Georgia / Times New Roman) at 12 pt with 1.4 line-height, which converts
 * to about 6 mm per line for the calculations below.
 */

/** A4 paper dimensions in millimetres (ISO 216). */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Standard print margin on each side, in millimetres. */
export const PRINT_MARGIN_MM = 15;

/** Usable area after subtracting margins from both sides. */
export const USABLE_WIDTH_MM = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;
export const USABLE_HEIGHT_MM = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;

/** Battle-tested print body text: serif 12 pt with 1.4 line-height. */
export const PRINT_FONT_SIZE_PT = 12;
export const PRINT_LINE_HEIGHT_RATIO = 1.4;

/**
 * Approximate height of a single line of body text in millimetres.
 * 12 pt * 1.4 ≈ 16.8 pt ≈ 5.93 mm; rounded up to 6 mm so estimates stay safe.
 */
export const LINE_HEIGHT_MM = 6;

/** Maximum number of text lines that fit within the usable A4 height. */
export const MAX_LINES_A4 = Math.floor(USABLE_HEIGHT_MM / LINE_HEIGHT_MM);

/**
 * Base vertical gap shared by question→answer spacing and answer→answer
 * spacing. The gap between two consecutive questions is exactly double this.
 */
export const BASE_GAP_MM = 4;

/** Gap between two consecutive questions (double the base gap). */
export const QUESTION_GAP_MM = BASE_GAP_MM * 2;

/** How much answers/images are indented relative to the question text. */
export const BODY_INDENT_MM = 8;

/** Portion of the usable width reserved for a side-by-side image. */
export const SIDE_IMAGE_WIDTH_FRACTION = 3 / 5;

/**
 * Minimum width of a side-by-side image, as a fraction of the usable width.
 * Narrower images are scaled up to it (keeping their aspect ratio) so they
 * don't visually blend into the answers next to them.
 */
export const SIDE_IMAGE_MIN_WIDTH_FRACTION = 1 / 3;

/** Hard limit for image height when placed above answers (in lines). */
export const OVER_PLACEMENT_MAX_LINES = 6;
export const OVER_PLACEMENT_MIN_LINES = 0;

/** Preferred minimum image height for side-by-side images (in lines). */
export const SIDE_PLACEMENT_MIN_LINES = 4;

export type ImagePlacementValue = 'over' | 'left' | 'right';

/**
 * Width available to an 'over' image. Such images render inside the indented
 * print body, so the body indent is subtracted from the usable width —
 * otherwise a wide image would overflow and get letterboxed by CSS max-width.
 */
function overImageMaxWidthMm(): number {
	return USABLE_WIDTH_MM - BODY_INDENT_MM;
}

function sideImageWidthMm(): number {
	return USABLE_WIDTH_MM * SIDE_IMAGE_WIDTH_FRACTION;
}

function sideImageMinWidthMm(): number {
	return USABLE_WIDTH_MM * SIDE_IMAGE_MIN_WIDTH_FRACTION;
}

/** Natural image height (in lines) when rendered at the side-by-side width. */
function sideNaturalHeightLines(aspectRatio: number): number {
	if (!(aspectRatio > 0)) return 0;
	const heightMm = sideImageWidthMm() / aspectRatio;
	return Math.max(0, Math.floor(heightMm / LINE_HEIGHT_MM));
}

/** Minimum selectable image height (in lines) for a given placement. */
export function computeImageMinLines(placement: ImagePlacementValue, answersCount: number): number {
	if (placement === 'over') return OVER_PLACEMENT_MIN_LINES;
	return Math.max(SIDE_PLACEMENT_MIN_LINES, answersCount);
}

/** Maximum selectable image height (in lines) for a placement and aspect ratio. */
export function computeImageMaxLines(
	naturalWidth: number,
	naturalHeight: number,
	placement: ImagePlacementValue,
	answersCount: number
): number {
	if (placement === 'over') {
		if (naturalWidth <= 0 || naturalHeight <= 0) return OVER_PLACEMENT_MAX_LINES;
		const aspectRatio = naturalWidth / naturalHeight;
		const linesFromWidth = Math.max(
			OVER_PLACEMENT_MIN_LINES,
			Math.floor(overImageMaxWidthMm() / aspectRatio / LINE_HEIGHT_MM)
		);
		return Math.min(OVER_PLACEMENT_MAX_LINES, linesFromWidth);
	}

	// Side-by-side placement: the image may occupy up to 3/5 of the usable
	// width. Its height is measured in lines and must at least match the
	// answers stack, while never exceeding what physically fits.
	const minLines = Math.max(SIDE_PLACEMENT_MIN_LINES, answersCount);

	if (naturalWidth <= 0 || naturalHeight <= 0) return minLines;

	const aspectRatio = naturalWidth / naturalHeight;
	const linesFromWidth = Math.max(1, sideNaturalHeightLines(aspectRatio));
	const linesFromPage = MAX_LINES_A4;
	return Math.max(minLines, Math.min(linesFromWidth, linesFromPage));
}

export interface ImageDisplaySize {
	widthMm: number;
	heightMm: number;
}

/**
 * Resolve the physical (mm) size an image should be rendered at for print.
 *
 * - `requestedLines` is the stored `imageHeight` expressed in text lines.
 * - The height is clamped to the placement's [min,max] range.
 * - The width follows the natural aspect ratio but is capped at the maximum
 *   width available for the placement (the indented body width for 'over',
 *   3/5 of the usable width for 'left'/'right').
 * - Side-by-side images are additionally scaled up to a minimum of 1/3 of
 *   the usable width so they don't blend into the answers next to them.
 */
export function computeImageDisplaySize(
	naturalWidth: number,
	naturalHeight: number,
	placement: ImagePlacementValue,
	answersCount: number,
	requestedLines: number | null | undefined
): ImageDisplaySize {
	const aspectRatio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;

	const minLines = computeImageMinLines(placement, answersCount);
	const maxLines = computeImageMaxLines(naturalWidth, naturalHeight, placement, answersCount);
	const lo = Math.min(minLines, maxLines);
	const hi = Math.max(minLines, maxLines);

	const defaultOver = Math.min(4, hi, Math.max(lo, 4));
	const fallback = placement === 'over' ? defaultOver : lo;
	const lines = clamp(requestedLines ?? fallback, lo, hi);

	const maxWidthMm = placement === 'over' ? overImageMaxWidthMm() : sideImageWidthMm();

	let heightMm = lines * LINE_HEIGHT_MM;
	let widthMm = heightMm * aspectRatio;
	if (widthMm > maxWidthMm) {
		widthMm = maxWidthMm;
		heightMm = widthMm / aspectRatio;
	}
	if (placement !== 'over' && widthMm < sideImageMinWidthMm()) {
		widthMm = sideImageMinWidthMm();
		heightMm = widthMm / aspectRatio;
	}

	return { widthMm, heightMm };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
