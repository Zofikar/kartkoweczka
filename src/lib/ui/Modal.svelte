<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		title?: string;
		children?: Snippet;
		footer?: Snippet;
		class?: never;
		[k: string]: unknown;
	}

	let { open = false, onclose, title, children, footer, ...restProps }: Props = $props();

	/** Syncs the native dialog with the `open` prop. showModal() gives a focus
	 *  trap, Escape handling (cancel event) and focus restoration for free. */
	function syncOpen(el: HTMLDialogElement) {
		if (open && !el.open) {
			el.showModal();
		} else if (!open && el.open) {
			el.close();
		}
	}

	function handleCancel(e: Event) {
		// Native Escape press — route through onclose instead of closing directly.
		e.preventDefault();
		onclose?.();
	}

	function handleClick(e: MouseEvent) {
		// Backdrop clicks land outside the dialog's bounds.
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const inDialog =
			e.clientX >= rect.left &&
			e.clientX <= rect.right &&
			e.clientY >= rect.top &&
			e.clientY <= rect.bottom;
		if (!inDialog) onclose?.();
	}
</script>

<dialog
	{@attach syncOpen}
	class="modal"
	oncancel={handleCancel}
	onclick={handleClick}
	aria-label={title}
	{...restProps}
>
	{#if title}
		<header class="modal-header">
			<h2 class="modal-title">{title}</h2>
		</header>
	{/if}
	<div class="modal-body">
		{@render children?.()}
	</div>
	{#if footer}
		<footer class="modal-footer">
			{@render footer()}
		</footer>
	{/if}
</dialog>

<style>
	.modal {
		border: 1px solid var(--background-muted);
		padding: 0;
		background-color: var(--background);
		color: var(--text);
		border-radius: var(--radius-lg);
		max-width: 560px;
		width: calc(100% - var(--space-8));
		max-height: calc(100vh - var(--space-16));
		overflow-y: auto;
		flex-direction: column;
	}

	.modal[open] {
		display: flex;
	}

	.modal::backdrop {
		background-color: rgba(0, 0, 0, 0.6);
	}

	.modal-header {
		padding: var(--space-4) var(--space-6);
		border-bottom: 1px solid var(--background-muted);
	}

	.modal-title {
		font-family: var(--font-sans);
		font-size: var(--font-xl);
		font-weight: var(--font-semibold);
		color: var(--text);
		margin: 0;
	}

	.modal-body {
		padding: var(--space-4) var(--space-6);
		flex: 1;
	}

	.modal-footer {
		padding: var(--space-3) var(--space-6);
		border-top: 1px solid var(--background-muted);
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
