<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '@/db/dbStore';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Badge from '@/lib/ui/Badge.svelte';
	import { loadAllTests, type TestSummary } from './service';
	import type { Database } from '@/db/db';
	import { navigate, p } from '@/router';

	let database = $state<Database | null>(null);
	let tests = $state<TestSummary[]>([]);
	let loading = $state(true);

	onMount(() => {
		return db.subscribe(async (d) => {
			if (d && !database) {
				database = d;
				await refreshTests();
			}
		});
	});

	async function refreshTests() {
		if (!database) return;
		loading = true;
		tests = await loadAllTests(database);
		loading = false;
	}
</script>

<div class="tests-page">
	<div class="tests-header">
		<Heading level={2}>Testy</Heading>
		<Button variant="primary" onclick={() => navigate('/tests/new')}>+ Nowy test</Button>
	</div>

	{#if loading}
		<Text variant="muted">Ładowanie...</Text>
	{:else}
		<div class="tests-list">
			{#if tests.length === 0}
				<Card padding="lg">
					<Text variant="muted">Brak testów. Utwórz pierwszy!</Text>
				</Card>
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

<style>
	.tests-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
	}

	.tests-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
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
