<script lang="ts">
	import Heading from '../../lib/ui/Heading.svelte';
	import Text from '../../lib/ui/Text.svelte';
	import Card from '../../lib/ui/Card.svelte';

	interface Props {
		[k: string]: unknown;
	}

	let { ...restProps }: Props = $props();
</script>

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
