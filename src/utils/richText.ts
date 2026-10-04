import Quill from 'quill';
import Embed from 'quill/blots/embed';
import { convertLatexToMarkup } from 'mathlive';
import { i18n } from '@/lib/i18n.svelte';

class MathChipBlot extends Embed {
	static blotName = 'math-chip';
	static tagName = 'span';
	static className = 'ql-math-chip';

	static create(latex: string): Node {
		const node = super.create() as HTMLElement;
		node.setAttribute('data-latex', latex);
		node.setAttribute('contenteditable', 'false');
		node.title = i18n.t('mathEditor.editHint');
		try {
			node.innerHTML = convertLatexToMarkup(`\\(${latex}\\)`);
		} catch {
			node.textContent = latex;
		}
		return node;
	}

	static value(domNode: Element): string | null {
		return (domNode as HTMLElement).getAttribute('data-latex');
	}
}

let blotRegistered = false;

export function registerMathChipBlot(): void {
	if (blotRegistered) return;
	try {
		Quill.register({ 'blots/math-chip': MathChipBlot }, true);
		blotRegistered = true;
	} catch {
		/* MathChipBlot already registered */
		blotRegistered = true;
	}
}

export function extractPlainText(ops: { insert?: unknown }[]): string {
	const parts: string[] = [];
	for (const op of ops) {
		if (typeof op.insert === 'string') {
			parts.push(op.insert);
		} else if (op.insert && typeof op.insert === 'object') {
			const e = op.insert as Record<string, unknown>;
			const latex = String(e['math-chip'] ?? '');
			if (latex.trim()) parts.push(`$$${latex}$$`);
		}
	}
	return parts.join('');
}

export function parseTextToOps(text: string): Record<string, unknown>[] {
	const ops: Record<string, unknown>[] = [];
	let remaining = text;
	while (remaining.length > 0) {
		const si = remaining.indexOf('$$');
		if (si === -1) {
			if (remaining.length > 0) ops.push({ insert: remaining });
			break;
		}
		if (si > 0) ops.push({ insert: remaining.slice(0, si) });
		const after = remaining.slice(si + 2);
		const ei = after.indexOf('$$');
		if (ei === -1) {
			ops.push({ insert: remaining.slice(si) });
			break;
		}
		const latex = after.slice(0, ei).trim();
		if (latex) ops.push({ insert: { 'math-chip': latex } });
		remaining = after.slice(ei + 2);
	}
	if (ops.length === 0) ops.push({ insert: '\n' });
	return ops;
}
