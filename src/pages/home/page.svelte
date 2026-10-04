<script lang="ts">
	import Heading from '../../lib/ui/Heading.svelte';
	import Text from '../../lib/ui/Text.svelte';
	import Card from '../../lib/ui/Card.svelte';
	import { i18n } from '../../lib/i18n.svelte';

	interface Props {
		[k: string]: unknown;
	}

	let { ...restProps }: Props = $props();
</script>

<svelte:head>
	<title>{i18n.t('home.title')}</title>
	<meta name="description" content={i18n.t('home.description')} />
</svelte:head>

<div class="home-page" {...restProps}>
	<Card padding="lg">
		<Heading level={1}>{i18n.t('home.welcome')}</Heading>
		<Text variant="body">{i18n.t('home.tagline')}</Text>
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
