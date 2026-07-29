<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
		type?: 'button' | 'submit' | 'reset';
		[k: string]: unknown;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		onclick,
		children,
		type = 'button',
		...restProps
	}: Props = $props();
</script>

<button class="button button--{variant} button--{size}" {type} {disabled} {onclick} {...restProps}>
	{@render children?.()}
</button>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border: 2px solid transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-weight: var(--font-medium);
		cursor: pointer;
		transition: all 150ms ease;
		text-decoration: none;
		line-height: 1;
	}

	.button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Sizes */
	.button--sm {
		padding: var(--space-1) var(--space-3);
		font-size: var(--font-sm);
	}
	.button--md {
		padding: var(--space-2) var(--space-4);
		font-size: var(--font-base);
	}
	.button--lg {
		padding: var(--space-3) var(--space-6);
		font-size: var(--font-lg);
	}

	/* Variants */
	.button--primary {
		background-color: var(--primary);
		color: var(--primary-text);
		border-color: var(--primary);
	}
	.button--primary:hover:not(:disabled) {
		background-color: var(--primary-muted);
	}

	.button--secondary {
		background-color: var(--secondary);
		color: var(--secondary-text);
		border-color: var(--secondary);
	}
	.button--secondary:hover:not(:disabled) {
		background-color: var(--secondary-muted);
	}

	.button--accent {
		background-color: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
	}
	.button--accent:hover:not(:disabled) {
		background-color: var(--accent-muted);
	}

	.button--outline {
		background-color: transparent;
		color: var(--text);
		border-color: var(--primary);
	}
	.button--outline:hover:not(:disabled) {
		background-color: var(--primary);
		color: var(--primary-text);
	}

	.button--ghost {
		background-color: transparent;
		color: var(--text);
		border-color: transparent;
	}
	.button--ghost:hover:not(:disabled) {
		background-color: var(--background-muted);
		color: var(--text);
	}

	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
