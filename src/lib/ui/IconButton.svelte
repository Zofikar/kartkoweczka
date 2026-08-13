<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		ariaLabel: string;
		variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
		class?: never;
		[k: string]: unknown;
	}

	let {
		ariaLabel,
		variant = 'primary',
		size = 'md',
		disabled = false,
		onclick,
		children,

		...restProps
	}: Props = $props();
</script>

<button
	class="icon-button icon-button--{variant} icon-button--{size}"
	{disabled}
	{onclick}
	aria-label={ariaLabel}
	{...restProps}
>
	{@render children?.()}
</button>

<style>
	.icon-button {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: var(--control-border-w) solid transparent;
		border-radius: var(--control-radius);
		font-family: var(--font-sans);
		cursor: pointer;
		transition: all 150ms ease;
		line-height: 1;
		flex-shrink: 0;
	}

	.icon-button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* Square — width matches the unified control height */
	.icon-button--sm {
		width: var(--control-h-sm);
		height: var(--control-h-sm);
		font-size: var(--control-font-md);
	}
	.icon-button--md {
		width: var(--control-h-md);
		height: var(--control-h-md);
		font-size: var(--control-font-lg);
	}
	.icon-button--lg {
		width: var(--control-h-lg);
		height: var(--control-h-lg);
		font-size: var(--font-xl);
	}

	.icon-button--primary {
		background-color: var(--primary);
		color: var(--primary-text);
		border-color: var(--primary);
	}
	.icon-button--primary:hover:not(:disabled) {
		background-color: var(--primary-muted);
	}

	.icon-button--secondary {
		background-color: var(--secondary);
		color: var(--secondary-text);
		border-color: var(--secondary);
	}
	.icon-button--secondary:hover:not(:disabled) {
		background-color: var(--secondary-muted);
	}

	.icon-button--accent {
		background-color: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
	}
	.icon-button--accent:hover:not(:disabled) {
		background-color: var(--accent-muted);
	}

	.icon-button--outline {
		background-color: transparent;
		color: var(--text);
		border-color: var(--primary);
	}
	.icon-button--outline:hover:not(:disabled) {
		background-color: var(--primary);
		color: var(--primary-text);
	}

	.icon-button--ghost {
		background-color: transparent;
		color: var(--text);
		border-color: transparent;
	}
	.icon-button--ghost:hover:not(:disabled) {
		background-color: var(--background-muted);
		color: var(--text);
	}

	.icon-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
