<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'body' | 'muted' | 'small' | 'error';
		as?: 'p' | 'span';
		children?: Snippet;
		class?: never;
		[k: string]: unknown;
	}

	let { variant = 'body', as = 'p', children, ...restProps }: Props = $props();
</script>

<svelte:element this={as} class="text text--{variant}" {...restProps}>
	{@render children?.()}
</svelte:element>

<style>
	.text {
		font-family: var(--font-sans);
		color: var(--text);
		margin: 0;
		line-height: 1.5;
	}

	.text--body {
		font-size: var(--font-base);
	}

	.text--muted {
		font-size: var(--font-base);
		color: var(--text-muted);
	}

	.text--small {
		font-size: var(--font-sm);
	}

	.text--error {
		font-size: var(--font-base);
		color: var(--error);
	}
</style>
