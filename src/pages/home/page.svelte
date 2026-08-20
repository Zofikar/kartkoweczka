<script lang="ts">
	import Heading from '../../lib/ui/Heading.svelte';
	import Text from '../../lib/ui/Text.svelte';
	import Card from '../../lib/ui/Card.svelte';

	interface Props {
		[k: string]: unknown;
	}

	let { ...restProps }: Props = $props();
</script>

<svelte:head>
	<title>Kartkóweczka – generator testów i arkuszy odpowiedzi</title>
	<meta
		name="description"
		content="Kartkóweczka – aplikacja do generowania i sprawdzania testów jedno lub wielokrotnego wyboru. Twórz pytania, generuj arkusze odpowiedzi i automatycznie oceniaj testy."
	/>
</svelte:head>

<div class="home-page" {...restProps}>
	<Card padding="lg">
		<Heading level={1}>Witaj w Kartkówka</Heading>
		<Text variant="body">Generator testów i arkuszy odpowiedzi z automatycznym ocenianiem.</Text>
	</Card>
</div>

<style>
	.home-page {
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
