<script lang="ts">
	import IconButton from '@/lib/ui/IconButton.svelte';

	interface Props {
		/** Disable the up button (e.g. first item). */
		disableUp?: boolean;
		/** Disable the down button (e.g. last item). */
		disableDown?: boolean;
		/** What is being moved, used for aria labels — e.g. 'pytanie' or 'odpowiedź'. */
		itemLabel?: string;
		onmove?: (direction: -1 | 1) => void;
	}

	let { disableUp = false, disableDown = false, itemLabel = 'element', onmove }: Props = $props();
</script>

<div class="order-controls">
	<IconButton
		variant="outline"
		size="sm"
		ariaLabel="Przesuń {itemLabel} wyżej"
		disabled={disableUp}
		onclick={() => onmove?.(-1)}
	>
		↑
	</IconButton>
	<IconButton
		variant="outline"
		size="sm"
		ariaLabel="Przesuń {itemLabel} niżej"
		disabled={disableDown}
		onclick={() => onmove?.(1)}
	>
		↓
	</IconButton>
</div>

<style>
	.order-controls {
		display: flex;
		gap: var(--space-1);
		flex-shrink: 0;
	}
</style>
