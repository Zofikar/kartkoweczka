<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		title?: string;
		children?: Snippet;
		footer?: Snippet;
		[k: string]: unknown;
	}

	let { open = false, onclose, title, children, footer, ...restProps }: Props = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose?.();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose?.();
		}
	}
</script>

{#if open}
	<div
		class="modal-backdrop"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="presentation"
	>
		<div class="modal" role="dialog" aria-modal="true" aria-label={title} {...restProps}>
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
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.6);
	}

	.modal {
		background-color: var(--background);
		border-radius: var(--radius-lg);
		border: 1px solid var(--background-muted);
		max-width: 560px;
		width: calc(100% - var(--space-8));
		max-height: calc(100vh - var(--space-16));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
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
