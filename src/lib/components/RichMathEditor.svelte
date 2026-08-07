<script lang="ts">
	import 'mathlive';
	import 'quill/dist/quill.bubble.css';
	import Quill from 'quill';
	import Delta from 'quill-delta';
	import type { MathfieldElement } from 'mathlive';
	import type { Blot } from 'parchment';
	import Button from '@/lib/ui/Button.svelte';
	import IconButton from '@/lib/ui/IconButton.svelte';
	import { registerMathChipBlot, extractPlainText, parseTextToOps } from '@/utils/richText';

	interface Props {
		value?: string;
		size?: 'sm' | 'md' | 'lg';
		onchange?: (value: string) => void;
		id?: string;
		'aria-label'?: string;
	}

	let {
		value = $bindable(''),
		size = 'md',
		onchange,
		id,
		'aria-label': ariaLabel,
	}: Props = $props();

	registerMathChipBlot();

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
			value = getQuillPlainText(quill!);
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
		if (value !== getQuillPlainText(quill)) {
			suppressChange = true;
			setQuillContent(quill, value);
			suppressChange = false;
		}
	});

	function setQuillContent(q: Quill, text: string) {
		q.setContents(new Delta(parseTextToOps(text)), 'silent');
	}

	function getQuillPlainText(q: Quill): string {
		return extractPlainText(q.getContents().ops);
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
		return quill ? getQuillPlainText(quill) : value;
	}
	export function focus() {
		quill?.focus();
	}
</script>

<div class="rich-editor-wrapper rich-editor-wrapper--{size}" role="region" aria-label={ariaLabel}>
	<div class="rich-editor rich-editor--{size}" {id}>
		<div
			bind:this={editorContainerEl}
			class="quill-container"
			role="textbox"
			aria-multiline="true"
			tabindex="0"
		></div>
	</div>
	<IconButton
		variant="outline"
		{size}
		ariaLabel="Wstaw wzór matematyczny"
		onclick={openPopoverForNew}
		title="Wstaw wzór matematyczny"
	>
		∑
	</IconButton>

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
				<Button variant="ghost" size="sm" onclick={cancelPopover}>Anuluj</Button>
				<Button variant="primary" size="sm" onclick={confirmPopover}>Wstaw wzór</Button>
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
		min-width: 0;
		font-family: var(--font-sans);
		color: var(--text);
		background-color: var(--background);
		border: var(--control-border-w) solid var(--background-muted);
		border-radius: var(--control-radius);
		outline: none;
		transition: border-color 150ms ease;
	}
	.rich-editor:focus-within {
		border-color: var(--primary);
	}
	.rich-editor--sm {
		min-height: var(--control-h-sm);
		font-size: var(--control-font-sm);
	}
	.rich-editor--md {
		min-height: var(--control-h-md);
		font-size: var(--control-font-md);
	}
	.rich-editor--lg {
		min-height: var(--control-h-lg);
		font-size: var(--control-font-lg);
	}
	.quill-container {
		min-height: inherit;
	}
	.rich-editor :global(.ql-editor) {
		padding: var(--space-2) var(--control-px-md);
		line-height: 1.5;
		font-family: var(--font-sans);
		font-size: inherit;
		color: var(--text);
	}
	.rich-editor--sm :global(.ql-editor) {
		padding: var(--space-1) var(--control-px-sm);
	}
	.rich-editor--lg :global(.ql-editor) {
		padding: var(--space-3) var(--control-px-lg);
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
</style>
