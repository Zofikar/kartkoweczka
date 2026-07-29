<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children?: Snippet;
		[k: string]: unknown;
	}

	let { padding = 'md', children, ...restProps }: Props = $props();

	const paddingMap: Record<string, string> = {
		none: '0',
		sm: 'var(--space-2)',
		md: 'var(--space-4)',
		lg: 'var(--space-6)',
	};
</script>

<div class="card card--{padding}" style="padding: {paddingMap[padding]}" {...restProps}>
	{@render children?.()}
</div>

<style>
	.card {
		background-color: var(--background-muted);
		border-radius: var(--radius-md);
		border: 1px solid transparent;
	}
</style>
