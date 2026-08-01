import { convertLatexToMarkup } from 'mathlive';

export function renderLatex(text: string): string {
	if (!text) return '';

	// If text has no $ delimiters but has LaTeX commands like \sqrt, \frac,
	// wrap it in inline math delimiters for rendering.
	if (!/[$]/.test(text) && /\\[a-zA-Z]+/.test(text)) {
		return `\\(${text}\\)`;
	}

	// Let MathLive handle all $...$ and $$...$$ and \(...\) and \[...\] patterns
	return text;
}

export function renderLatexToHtml(text: string): string {
	return convertLatexToMarkup(renderLatex(text));
}

// ── Rich content segments (text + inline math) ───────────────────────────────

export interface ContentSegment {
	type: 'text' | 'math';
	value: string;
}

export type RichContent = ContentSegment[];

/**
 * Serialize rich content segments to a JSON string for storage.
 * Returns plain text if there's only one text segment (backwards compat).
 */
export function serializeRichContent(segments: RichContent): string {
	// If it's just a single text segment, return the plain text
	if (segments.length === 1 && segments[0].type === 'text') {
		return segments[0].value;
	}
	return JSON.stringify(segments);
}

/**
 * Parse a stored content string back into segments.
 * If content is plain text (no JSON array), wrap it as a single text segment.
 */
export function parseRichContent(content: string | null | undefined): RichContent {
	if (!content) return [];

	// Try JSON parse
	if (content.startsWith('[')) {
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(s: unknown): s is ContentSegment =>
						typeof s === 'object' &&
						s !== null &&
						(s as ContentSegment).type !== undefined &&
						(s as ContentSegment).value !== undefined
				);
			}
		} catch {
			// fall through to plain text
		}
	}

	// Plain text content
	return [{ type: 'text', value: content }];
}

/**
 * Convert rich content segments to a single LaTeX-compatible string.
 * Text segments pass through, math segments get wrapped in \(...\) delimiters.
 */
export function richContentToLatex(segments: RichContent): string {
	return segments
		.map((seg) => {
			if (seg.type === 'math') {
				return `\\(${seg.value}\\)`;
			}
			return seg.value;
		})
		.join('');
}

function escapeHtml(text: string): string {
	const A = String.fromCharCode(38);
	return text
		.replace(RegExp(A, 'g'), A + 'amp;')
		.replace(/</g, A + 'lt;')
		.replace(/>/g, A + 'gt;')
		.replace(/"/g, A + 'quot;')
		.replace(/'/g, A + '#039;');
}

/**
 * Render rich content segments to HTML for display.
 * Text segments are HTML-escaped, math segments are rendered via convertLatexToMarkup.
 * Handles both legacy plain-text and new rich-content formats.
 */
export function renderRichContentToHtml(content: string | null | undefined): string {
	const segments = parseRichContent(content);

	// If it's a single text segment, render it as LaTeX (handles $...$ delimiters in legacy text)
	if (segments.length === 1 && segments[0].type === 'text') {
		return renderLatexToHtml(segments[0].value);
	}

	// For rich content, escape text segments and render math segments.
	// Join with a space so text and formulas don't run together.
	return segments
		.map((seg) => {
			if (seg.type === 'math') {
				return convertLatexToMarkup(`\\(${seg.value}\\)`);
			}
			return escapeHtml(seg.value);
		})
		.join('');
}
