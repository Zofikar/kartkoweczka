<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'unordered' | 'ordered';
		children?: Snippet;
		class?: never;
		[k: string]: unknown;
	}

	let { type = 'unordered', children, ...restProps }: Props = $props();
</script>

<svelte:element this={type === 'ordered' ? 'ol' : 'ul'} class="list" {...restProps}>
	{@render children?.()}
</svelte:element>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
</style>
