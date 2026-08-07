<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		level?: 1 | 2 | 3 | 4 | 5 | 6;
		children?: Snippet;
		class?: never;
		[k: string]: unknown;
	}

	let { level = 1, children, ...restProps }: Props = $props();

	const fontSizes: Record<number, string> = {
		1: 'var(--font-4xl)',
		2: 'var(--font-3xl)',
		3: 'var(--font-2xl)',
		4: 'var(--font-xl)',
		5: 'var(--font-lg)',
		6: 'var(--font-base)',
	};
</script>

<svelte:element
	this={'h' + level}
	class="heading heading--{level}"
	style="font-size: {fontSizes[level]}"
	{...restProps}
>
	{@render children?.()}
</svelte:element>

<style>
	.heading {
		font-family: var(--font-sans);
		font-weight: var(--font-bold);
		color: var(--text);
		margin: 0;
		line-height: 1.2;
	}
</style>
