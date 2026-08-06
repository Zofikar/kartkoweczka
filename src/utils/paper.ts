/** A4 paper dimensions in millimetres (ISO 216). */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Standard print margin on each side, in millimetres. */
export const PRINT_MARGIN_MM = 15;

/** Usable area after subtracting margins from both sides. */
export const USABLE_WIDTH_MM = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;
export const USABLE_HEIGHT_MM = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;

/**
 * Approximate height of a single line of body text in millimetres.
 * Based on ~12 pt font with ~1.4–1.5× line spacing.
 */
export const LINE_HEIGHT_MM = 6;

/** Maximum number of text lines that fit within the usable A4 height. */
export const MAX_LINES_A4 = Math.floor(USABLE_HEIGHT_MM / LINE_HEIGHT_MM);

/** Hard limit for image height when placed above answers (in lines). */
export const OVER_PLACEMENT_MAX_LINES = 6;

/**
 * Compute the maximum image height (in lines) that fits on A4 paper
 * given the image's natural dimensions, its placement relative to answers,
 * and the number of answers.
 *
 * - 'over': hard-capped at {@link OVER_PLACEMENT_MAX_LINES} lines (answers count ignored).
 * - 'left' / 'right': lower bound is max(4, answersCount), upper bound is what fits
 *   within the effective usable width (3/5 of usable width for side-by-side).
 */
export function computeMaxImageLines(
	imageNaturalWidth: number,
	imageNaturalHeight: number,
	placement: 'over' | 'left' | 'right',
	answersCount: number
): number {
	if (imageNaturalWidth <= 0 || imageNaturalHeight <= 0) {
		return placement === 'over' ? OVER_PLACEMENT_MAX_LINES : Math.max(4, answersCount);
	}

	const aspectRatio = imageNaturalWidth / imageNaturalHeight;

	if (placement === 'over') {
		const imageHeightMmAtFullWidth = USABLE_WIDTH_MM / aspectRatio;
		const linesFromWidth = Math.floor(imageHeightMmAtFullWidth / LINE_HEIGHT_MM);
		return Math.min(OVER_PLACEMENT_MAX_LINES, linesFromWidth);
	}

	// Side-by-side placement: image gets 3/5 of usable width.
	const effectiveWidthMm = USABLE_WIDTH_MM * (3 / 5);
	const imageHeightMmAtEffectiveWidth = effectiveWidthMm / aspectRatio;
	const linesFromWidth = Math.floor(imageHeightMmAtEffectiveWidth / LINE_HEIGHT_MM);
	const linesFromPage = Math.floor(USABLE_HEIGHT_MM / LINE_HEIGHT_MM);

	const whatFits = Math.min(linesFromWidth, linesFromPage);

	return Math.min(Math.max(4, answersCount), whatFits);
}
