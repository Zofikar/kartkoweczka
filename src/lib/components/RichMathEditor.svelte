<script lang="ts">
	import 'mathlive';
	import 'quill/dist/quill.bubble.css';
	import Quill from 'quill';
	import Delta from 'quill-delta';
	import Embed from 'quill/blots/embed';
	import type { MathfieldElement } from 'mathlive';
	import { convertLatexToMarkup } from 'mathlive';
	import type { Blot } from 'parchment';

	interface Props {
		value?: string;
		size?: 'normal' | 'sm';
		class?: string;
		onchange?: (value: string) => void;
		id?: string;
		'aria-label'?: string;
	}

	let {
		value = $bindable(''),
		size = 'normal',
		class: className = '',
		onchange,
		id,
		'aria-label': ariaLabel,
	}: Props = $props();

	class MathChipBlot extends Embed {
		static blotName = 'math-chip';
		static tagName = 'span';
		static className = 'ql-math-chip';

		static create(latex: string): Node {
			const node = super.create() as HTMLElement;
			node.setAttribute('data-latex', latex);
			node.setAttribute('contenteditable', 'false');
			node.title = 'Kliknij, aby edytować';
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

	try {
		Quill.register({ 'blots/math-chip': MathChipBlot }, true);
	} catch {
		/* MathChipBlot already registered */
	}

	let editorContainerEl: HTMLDivElement | undefined = $state();
	let quill: Quill | undefined;
	let initialised = $state(false);
	let suppressChange = false;

	let showPopover = $state(false);
	let editingBlot: HTMLElement | null = null;
	let popoverLiveLatex = $state('');
	let insertIndex = $state(0);
	let popoverMf: MathfieldElement | undefined = $state();

	$effect(() => {
		if (!editorContainerEl || initialised) return;

		quill = new Quill(editorContainerEl, {
			theme: 'bubble',
			placeholder: '',
			formats: null,
			modules: { toolbar: false },
		});

		setQuillContent(quill, value);

		quill.on('text-change', () => {
			if (suppressChange) return;
			value = extractPlainText(quill!);
			onchange?.(value);
		});

		quill.root.addEventListener('keydown', (e: Event) => {
			const key = (e as KeyboardEvent).key;
			if (key === 'Enter' && !(e as KeyboardEvent).shiftKey) {
				e.preventDefault();
			}
			if (key === 'Escape' && showPopover) {
				e.preventDefault();
				e.stopPropagation();
				cancelPopover();
			}
		});

		quill.root.addEventListener('click', (e: Event) => {
			const chip = (e.target as HTMLElement).closest('.ql-math-chip') as HTMLElement | null;
			if (!chip || !quill) return;
			e.stopPropagation();
			const latex = chip.getAttribute('data-latex') ?? '';
			openPopover(latex, chip);
		});

		initialised = true;
	});

	$effect(() => {
		if (!quill || !initialised) return;
		if (value !== extractPlainText(quill)) {
			suppressChange = true;
			setQuillContent(quill, value);
			suppressChange = false;
		}
	});

	function setQuillContent(q: Quill, text: string) {
		q.setContents(new Delta(parseTextToOps(text)), 'silent');
	}

	function extractPlainText(q: Quill): string {
		const parts: string[] = [];
		for (const op of q.getContents().ops) {
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

	function parseTextToOps(text: string): Record<string, unknown>[] {
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

	function openPopover(latex: string, blotElement: HTMLElement | null) {
		if (!quill) return;
		if (blotElement) {
			editingBlot = blotElement;
		} else {
			const sel = quill.getSelection();
			insertIndex = sel ? sel.index : quill.getLength() - 1;
			editingBlot = null;
		}
		popoverLiveLatex = latex;
		showPopover = true;

		requestAnimationFrame(() => {
			if (popoverMf) {
				popoverMf.setValue(latex);
				popoverMf.focus();
			}
		});
	}

	function handleMfInput(e: Event) {
		popoverLiveLatex = (e.target as MathfieldElement).value;
	}

	function confirmPopover() {
		if (!quill) return;
		const latex = popoverLiveLatex.trim();
		if (!latex) {
			cancelPopover();
			return;
		}

		if (editingBlot) {
			const blot = Quill.find(editingBlot) as Blot | null;
			if (blot) {
				const idx = quill.getIndex(blot);
				quill.deleteText(idx, 1, 'user');
				quill.insertEmbed(idx, 'math-chip', latex, 'user');
				quill.setSelection(idx + 1, 'silent');
			}
		} else {
			quill.insertEmbed(insertIndex, 'math-chip', latex, 'user');
			quill.setSelection(insertIndex + 1, 'silent');
		}

		showPopover = false;
		quill.focus();
	}

	function cancelPopover() {
		showPopover = false;
		quill?.focus();
	}

	function openPopoverForNew() {
		if (!quill) return;
		const sel = quill.getSelection();
		insertIndex = sel ? sel.index : quill.getLength() - 1;
		openPopover('', null);
	}

	function onMfKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			confirmPopover();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelPopover();
		}
	}

	export function getValue(): string {
		return quill ? extractPlainText(quill) : value;
	}
	export function focus() {
		quill?.focus();
	}
</script>

<div
	class="rich-editor-wrapper rich-editor-wrapper--{size} {className}"
	role="region"
	aria-label={ariaLabel}
>
	<div class="rich-editor rich-editor--{size}" {id}>
		<div
			bind:this={editorContainerEl}
			class="quill-container"
			role="textbox"
			aria-multiline="true"
			tabindex="0"
		></div>
	</div>
	<button
		type="button"
		class="insert-formula-btn insert-formula-btn--{size}"
		onclick={openPopoverForNew}
		title="Wstaw wzór matematyczny">∑</button
	>

	{#if showPopover}
		<div class="math-popover" role="dialog" aria-label="Edytor wzoru matematycznego">
			<math-field
				bind:this={popoverMf}
				role="textbox"
				aria-label="Wprowadź wzór matematyczny"
				tabindex="0"
				oninput={handleMfInput}
				onkeydown={onMfKeydown}
				style="display: block; width: 100%; font-size: var(--font-lg); min-height: 48px;"
				default-mode="inline-math"
			></math-field>
			<div class="math-popover-actions">
				<button type="button" class="popover-btn popover-btn--cancel" onclick={cancelPopover}
					>Anuluj</button
				>
				<button type="button" class="popover-btn popover-btn--confirm" onclick={confirmPopover}
					>Wstaw wzór</button
				>
			</div>
		</div>
	{/if}
</div>

<style>
	.rich-editor-wrapper {
		display: flex;
		gap: var(--space-1);
		align-items: flex-start;
		position: relative;
	}
	.rich-editor {
		flex: 1;
		min-height: 44px;
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		background-color: var(--background);
		border: 2px solid var(--background-muted);
		border-radius: var(--radius-md);
		outline: none;
		transition: border-color 150ms ease;
	}
	.rich-editor:focus-within {
		border-color: var(--primary);
	}
	.rich-editor--sm {
		min-height: 38px;
	}
	.quill-container {
		min-height: inherit;
	}
	.rich-editor :global(.ql-editor) {
		padding: var(--space-2) var(--space-3);
		line-height: 1.6;
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
	}
	.rich-editor--sm :global(.ql-editor) {
		padding: var(--space-1) var(--space-2);
		font-size: var(--font-base);
	}
	.rich-editor :global(.ql-editor).ql-blank::before {
		font-style: normal;
		color: var(--text-muted);
	}
	.rich-editor :global(.ql-tooltip) {
		display: none !important;
	}

	:global(.ql-math-chip) {
		display: inline-block;
		vertical-align: middle;
		margin: 0 2px;
		border: 1px solid color-mix(in srgb, var(--primary) 40%, transparent);
		border-radius: var(--radius-sm);
		padding: 1px 6px;
		background: color-mix(in srgb, var(--primary) 8%, var(--background));
		cursor: pointer;
		user-select: none;
		font-size: var(--font-base);
		line-height: 1.6;
		transition: background 150ms ease;
	}
	:global(.ql-math-chip):hover {
		background: color-mix(in srgb, var(--primary) 15%, var(--background));
	}

	.insert-formula-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 44px;
		border: 2px solid var(--background-muted);
		border-radius: var(--radius-md);
		background: var(--background);
		color: var(--text-muted);
		font-size: var(--font-lg);
		font-family: var(--font-sans);
		cursor: pointer;
		transition: all 150ms ease;
		padding: 0;
		line-height: 1;
	}
	.insert-formula-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 5%, var(--background));
	}
	.insert-formula-btn--sm {
		width: 30px;
		height: 38px;
		font-size: var(--font-base);
	}

	.math-popover {
		position: absolute;
		z-index: 1001;
		top: 100%;
		left: 0;
		margin-top: var(--space-2);
		min-width: 320px;
		max-width: min(480px, calc(100vw - var(--space-4)));
		background: var(--background);
		border: 2px solid var(--primary);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		overflow: hidden;
	}
	.math-popover :global(math-field) {
		max-width: 100%;
	}
	.math-popover-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.popover-btn {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		cursor: pointer;
		border: none;
		transition: all 150ms ease;
	}
	.popover-btn--cancel {
		background: var(--background-muted);
		color: var(--text-muted);
	}
	.popover-btn--cancel:hover {
		background: var(--background-muted);
		color: var(--text);
	}
	.popover-btn--confirm {
		background: var(--primary);
		color: var(--primary-text);
	}
	.popover-btn--confirm:hover {
		opacity: 0.9;
	}
</style>
