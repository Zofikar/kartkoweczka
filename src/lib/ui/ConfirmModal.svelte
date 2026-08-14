<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		open?: boolean;
		title?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		confirmVariant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'outline' | 'ghost';
		onconfirm?: () => void;
		oncancel?: () => void;
		children?: Snippet;
		/** Overrides the default cancel/confirm buttons when provided. */
		actions?: Snippet;
	}

	let {
		open = false,
		title,
		confirmLabel = 'Potwierdź',
		cancelLabel = 'Anuluj',
		confirmVariant = 'danger',
		onconfirm,
		oncancel,
		children,
		actions,
	}: Props = $props();
</script>

<Modal {open} onclose={oncancel} {title}>
	<p class="confirm-text">{@render children?.()}</p>
	{#snippet footer()}
		{#if actions}
			{@render actions()}
		{:else}
			<Button variant="ghost" onclick={oncancel}>{cancelLabel}</Button>
			<Button variant={confirmVariant} onclick={onconfirm}>{confirmLabel}</Button>
		{/if}
	{/snippet}
</Modal>

<style>
	.confirm-text {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		line-height: 1.5;
		margin: 0;
	}
</style>
