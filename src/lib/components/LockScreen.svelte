<script lang="ts">
	import Heading from '../ui/Heading.svelte';
	import Text from '../ui/Text.svelte';
	import Button from '../ui/Button.svelte';

	interface Props {
		deferredPrompt?: boolean;
		oninstall?: () => void;
		[k: string]: unknown;
	}

	let { deferredPrompt = false, oninstall, ...restProps }: Props = $props();
</script>

<div class="lock-screen" {...restProps}>
	<Heading level={1}>Wymagana instalacja aplikacji</Heading>
	<Text variant="body">Ta aplikacja działa wyłącznie jako zainstalowane PWA.</Text>

	{#if deferredPrompt}
		<Button variant="primary" onclick={oninstall}>Zainstaluj aplikację</Button>
	{:else}
		<Text variant="muted">
			Używasz urządzenia z iOS? Otwórz menu udostępnienia w przeglądarce i wybierz
			<strong>"Do ekranu początkowego"</strong>.
		</Text>
	{/if}
</div>

<style>
	.lock-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		text-align: center;
		padding: var(--space-8);
		height: 100%;
	}
</style>
