<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'outline' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
		type?: 'button' | 'submit' | 'reset';
		class?: never;
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
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border: var(--control-border-w) solid transparent;
		border-radius: var(--control-radius);
		font-family: var(--font-sans);
		font-weight: var(--font-medium);
		cursor: pointer;
		transition: all 150ms ease;
		text-decoration: none;
		line-height: 1;
		white-space: nowrap;
	}

	.button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* Sizes — fixed heights keep every control aligned */
	.button--sm {
		height: var(--control-h-sm);
		padding: 0 var(--control-px-sm);
		font-size: var(--control-font-sm);
	}
	.button--md {
		height: var(--control-h-md);
		padding: 0 var(--control-px-md);
		font-size: var(--control-font-md);
	}
	.button--lg {
		height: var(--control-h-lg);
		padding: 0 var(--control-px-lg);
		font-size: var(--control-font-lg);
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

	.button--danger {
		background-color: var(--error);
		color: var(--error-text);
		border-color: var(--error);
	}
	.button--danger:hover:not(:disabled) {
		background-color: var(--error);
		filter: brightness(1.1);
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
