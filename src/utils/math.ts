import { convertLatexToMarkup } from 'mathlive';

const MATH_DELIMITER = '$$';

const AMPERSAND = String.fromCharCode(38);

export function renderDocumentToHtml(content: string | null | undefined): string {
	if (!content) return '';

	const migrated = migrateToPlainFormat(content);

	if (!migrated.includes(MATH_DELIMITER)) {
		if (/\\[a-zA-Z]+/.test(migrated)) {
			return convertLatexToMarkup(wrapLatexIfNeeded(escapeHtml(migrated)));
		}
		return escapeHtml(migrated);
	}

	const parts: string[] = [];
	let remaining = migrated;

	while (remaining.length > 0) {
		const startIdx = remaining.indexOf(MATH_DELIMITER);
		if (startIdx === -1) {
			parts.push(escapeHtml(remaining));
			break;
		}

		if (startIdx > 0) {
			parts.push(escapeHtml(remaining.slice(0, startIdx)));
		}

		const afterStart = remaining.slice(startIdx + MATH_DELIMITER.length);
		const endIdx = afterStart.indexOf(MATH_DELIMITER);
		if (endIdx === -1) {
			parts.push(escapeHtml(remaining.slice(startIdx)));
			break;
		}

		const latex = afterStart.slice(0, endIdx).trim();
		if (latex) {
			parts.push(convertLatexToMarkup(`\\(${latex}\\)`));
		}

		remaining = afterStart.slice(endIdx + MATH_DELIMITER.length);
	}

	return parts.join('');
}

function escapeHtml(text: string): string {
	return text
		.replace(RegExp(AMPERSAND, 'g'), AMPERSAND + 'amp;')
		.replace(/</g, AMPERSAND + 'lt;')
		.replace(/>/g, AMPERSAND + 'gt;')
		.replace(/"/g, AMPERSAND + 'quot;')
		.replace(/'/g, AMPERSAND + '#039;');
}

function wrapLatexIfNeeded(text: string): string {
	if (!text) return '';
	if (/[$]/.test(text) || !/\\[a-zA-Z]+/.test(text)) {
		return text;
	}
	return `\\(${text}\\)`;
}

export function migrateToPlainFormat(content: string | null | undefined): string {
	const segments = parseToSegments(content);
	if (segments.length === 0) return '';
	if (segments.length === 1 && segments[0].type === 'text') {
		return segments[0].value;
	}
	return segments
		.map((seg) =>
			seg.type === 'math' ? `${MATH_DELIMITER}${seg.value}${MATH_DELIMITER}` : seg.value
		)
		.join('');
}

interface ContentSegment {
	type: 'text' | 'math';
	value: string;
}

function parseToSegments(content: string | null | undefined): ContentSegment[] {
	if (!content) return [];

	if (content.includes(MATH_DELIMITER)) {
		return parseDelimitedSegments(content);
	}

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
			/* legacy JSON that failed to parse — treat as plain text */
		}
	}

	return [{ type: 'text', value: content }];
}

function parseDelimitedSegments(content: string): ContentSegment[] {
	const segments: ContentSegment[] = [];
	let remaining = content;

	while (remaining.length > 0) {
		const startIdx = remaining.indexOf(MATH_DELIMITER);
		if (startIdx === -1) {
			if (remaining.length > 0) {
				segments.push({ type: 'text', value: remaining });
			}
			break;
		}

		if (startIdx > 0) {
			segments.push({ type: 'text', value: remaining.slice(0, startIdx) });
		}

		const afterStart = remaining.slice(startIdx + MATH_DELIMITER.length);
		const endIdx = afterStart.indexOf(MATH_DELIMITER);
		if (endIdx === -1) {
			segments.push({ type: 'text', value: remaining.slice(startIdx) });
			break;
		}

		const latex = afterStart.slice(0, endIdx).trim();
		if (latex) {
			segments.push({ type: 'math', value: latex });
		}

		remaining = afterStart.slice(endIdx + MATH_DELIMITER.length);
	}

	return segments;
}
