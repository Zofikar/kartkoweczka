<script lang="ts">
	import type { Snippet } from 'svelte';
	import Heading from './Heading.svelte';

	interface Props {
		title: string;
		/** Heading level — use 1 for the top-level page title. */
		level?: 1 | 2 | 3 | 4 | 5 | 6;
		/** Optional content (e.g. a back button) rendered before the title. */
		leading?: Snippet;
		/** Optional action buttons rendered at the right end. */
		actions?: Snippet;
	}

	let { title, level = 1, leading, actions }: Props = $props();
</script>

<div class="page-header">
	<div class="page-header-title">
		{#if leading}
			{@render leading()}
		{/if}
		<Heading {level}>{title}</Heading>
	</div>
	{#if actions}
		<div class="page-header-actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.page-header-title {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		min-width: 0;
	}

	.page-header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
</style>
