<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		error?: string;
		forId?: string;
		children?: Snippet;
		class?: never;
		[k: string]: unknown;
	}

	let { label, error, forId, children, ...restProps }: Props = $props();
</script>

<div class="field" class:field--error={!!error} {...restProps}>
	{#if label}
		<label class="field-label" for={forId}>{label}</label>
	{/if}
	{@render children?.()}
	{#if error}
		<span class="field-error">{error}</span>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.field-label {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		color: var(--text);
		line-height: 1.4;
	}

	.field-error {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--accent);
	}
</style>
