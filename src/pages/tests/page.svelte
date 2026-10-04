<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Badge from '@/lib/ui/Badge.svelte';
	import PageHeader from '@/lib/ui/PageHeader.svelte';
	import EmptyState from '@/lib/components/EmptyState.svelte';
	import { listTests, type TestSummary } from '@/db/repositories';
	import ImportTestModal from '@/lib/components/ImportTestModal.svelte';
	import { snackError } from '@/lib/stores/snackbar.svelte';
	import { navigate, p } from '@/router';
	import { i18n } from '@/lib/i18n.svelte';

	let tests = $state<TestSummary[]>([]);
	let loading = $state(true);
	let importOpen = $state(false);

	onMount(() => {
		void refreshTests();
	});

	async function refreshTests() {
		loading = true;
		try {
			tests = await listTests();
		} catch (err) {
			snackError(i18n.t('tests.loadError'));
			console.error('Failed to load tests:', err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{i18n.t('tests.pageTitle')}</title>
	<meta name="description" content={i18n.t('tests.description')} />
</svelte:head>

<div class="tests-page">
	<PageHeader title={i18n.t('tests.title')}>
		{#snippet actions()}
			<Button variant="outline" onclick={() => (importOpen = true)}>{i18n.t('tests.import')}</Button
			>
			<Button variant="primary" onclick={() => navigate('/tests/new')}>{i18n.t('tests.new')}</Button
			>
		{/snippet}
	</PageHeader>

	{#if loading}
		<Text variant="muted">{i18n.t('common.loading')}</Text>
	{:else}
		<div class="tests-list">
			{#if tests.length === 0}
				<EmptyState message={i18n.t('tests.empty')}>
					{#snippet actions()}
						<Button variant="primary" onclick={() => navigate('/tests/new')}
							>{i18n.t('tests.new')}</Button
						>
					{/snippet}
				</EmptyState>
			{:else}
				{#each tests as test (test.id)}
					<a href={p('/tests/:id', { params: { id: test.id } })} class="test-link">
						<Card padding="lg">
							<div class="test-row">
								<div class="test-info">
									<Heading level={4}>{test.name}</Heading>
									<Badge variant="secondary" size="sm">
										{test.questionCount}
										{i18n.t(test.questionCount === 1 ? 'tests.questionOne' : 'tests.questionMany')}
									</Badge>
								</div>
							</div>
						</Card>
					</a>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<ImportTestModal
	open={importOpen}
	onclose={() => (importOpen = false)}
	onImported={(id) => navigate('/tests/:id', { params: { id } })}
/>

<style>
	.tests-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
	}

	.tests-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-right: var(--space-1);
	}

	.test-link {
		text-decoration: none;
		color: inherit;
	}

	.test-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.test-info {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>
