<script lang="ts">
	import type { Snippet } from 'svelte';
	import Card from '@/lib/ui/Card.svelte';
	import Text from '@/lib/ui/Text.svelte';

	interface Props {
		message: string;
		/** Optional call-to-action rendered under the message. */
		actions?: Snippet;
	}

	let { message, actions }: Props = $props();
</script>

<Card padding="lg">
	<div class="empty-state">
		<Text variant="muted">{message}</Text>
		{#if actions}
			<div class="empty-state-actions">{@render actions()}</div>
		{/if}
	</div>
</Card>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
	}

	.empty-state-actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		justify-content: center;
	}
</style>
