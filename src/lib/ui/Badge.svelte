<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'accent';
		size?: 'sm' | 'md';
		children?: Snippet;
		[k: string]: unknown;
	}

	let { variant = 'primary', size = 'md', children, ...restProps }: Props = $props();
</script>

<span class="badge badge--{variant} badge--{size}" {...restProps}>
	{@render children?.()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-weight: var(--font-medium);
		border-radius: var(--radius-full);
		line-height: 1.4;
	}

	.badge--sm {
		font-size: var(--font-xs);
		padding: 2px var(--space-2);
	}

	.badge--md {
		font-size: var(--font-sm);
		padding: var(--space-1) var(--space-3);
	}

	.badge--primary {
		background-color: var(--primary);
		color: var(--primary-text);
	}

	.badge--secondary {
		background-color: var(--secondary);
		color: var(--secondary-text);
	}

	.badge--accent {
		background-color: var(--accent);
		color: var(--accent-text);
	}
</style>
