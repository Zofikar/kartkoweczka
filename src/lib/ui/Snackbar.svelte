<script lang="ts">
	import { getSnacks, dismissSnack } from '@/lib/stores/snackbar.svelte';
	import IconButton from './IconButton.svelte';
	import { i18n } from '../i18n.svelte';

	let snacks = $derived(getSnacks());
</script>

{#if snacks.length > 0}
	<div
		class="snackbar-container"
		role="status"
		aria-live="polite"
		aria-label={i18n.t('snackbar.notifications')}
	>
		{#each snacks as snack (snack.id)}
			<div class="snack snack--{snack.flavor}">
				<span class="snack-message">{snack.message}</span>
				<IconButton
					variant="ghost"
					size="sm"
					ariaLabel={i18n.t('snackbar.close')}
					onclick={() => dismissSnack(snack.id)}
				>
					✕
				</IconButton>
			</div>
		{/each}
	</div>
{/if}

<style>
	.snackbar-container {
		position: fixed;
		bottom: var(--space-4);
		left: 50%;
		transform: translateX(-50%);
		z-index: 2000;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: min(480px, calc(100vw - var(--space-8)));
		width: 100%;
		pointer-events: none;
	}

	.snack {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		line-height: 1.4;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		pointer-events: auto;
		animation: snack-slide-in 200ms ease-out;
	}

	.snack-message {
		flex: 1;
		min-width: 0;
	}

	.snack--success {
		background-color: var(--success);
		color: var(--success-text);
	}

	.snack--info {
		background-color: var(--info);
		color: var(--info-text);
	}

	.snack--warn {
		background-color: var(--warning);
		color: var(--warning-text);
	}

	.snack--error {
		background-color: var(--error);
		color: var(--error-text);
	}

	@keyframes snack-slide-in {
		from {
			opacity: 0;
			transform: translateY(var(--space-2));
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
