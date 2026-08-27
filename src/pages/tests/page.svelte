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
			snackError('Nie udało się wczytać testów');
			console.error('Failed to load tests:', err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Testy – Kartkóweczka</title>
	<meta
		name="description"
		content="Przeglądaj i zarządzaj testami w Kartkóweczce. Twórz nowe testy, generuj arkusze odpowiedzi i automatycznie oceniaj wyniki."
	/>
</svelte:head>

<div class="tests-page">
	<PageHeader title="Testy">
		{#snippet actions()}
			<Button variant="outline" onclick={() => (importOpen = true)}>Importuj test</Button>
			<Button variant="primary" onclick={() => navigate('/tests/new')}>+ Nowy test</Button>
		{/snippet}
	</PageHeader>

	{#if loading}
		<Text variant="muted">Ładowanie...</Text>
	{:else}
		<div class="tests-list">
			{#if tests.length === 0}
				<EmptyState message="Brak testów. Utwórz pierwszy!">
					{#snippet actions()}
						<Button variant="primary" onclick={() => navigate('/tests/new')}>+ Nowy test</Button>
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
										{test.questionCount === 1 ? 'pytanie' : 'pytań'}
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
