<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children?: Snippet;
		active?: boolean;
		class?: never;
		[k: string]: unknown;
	}

	let { padding = 'md', children, active, ...restProps }: Props = $props();

	const paddingMap: Record<string, string> = {
		none: '0',
		sm: 'var(--space-2)',
		md: 'var(--space-4)',
		lg: 'var(--space-6)',
	};
</script>

<div
	{...restProps}
	class="card {active ? 'card-active' : ''}"
	style="padding: {paddingMap[padding]}"
>
	{@render children?.()}
</div>

<style>
	.card {
		background-color: var(--background-muted);
		border-radius: var(--radius-md);
		border: 1px solid transparent;
	}

	.card-active {
		border-left-color: var(--primary);
	}
</style>
