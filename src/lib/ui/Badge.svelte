<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'accent';
		children?: Snippet;
		[k: string]: unknown;
	}

	let { variant = 'primary', children, ...restProps }: Props = $props();
</script>

<span class="badge badge--{variant}" {...restProps}>
	{@render children?.()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-sans);
		font-size: var(--font-xs);
		font-weight: var(--font-medium);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-full);
		line-height: 1;
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
