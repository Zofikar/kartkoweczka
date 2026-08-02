<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '@/db/dbStore';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import QuestionDisplay from '@/lib/components/QuestionDisplay.svelte';
	import QuestionEdit from '@/lib/components/QuestionEdit.svelte';
	import {
		createQuestion,
		deleteQuestion,
		loadAllQuestionsWithAnswers,
		type QuestionEditData,
		type QuestionWithAnswers,
		updateQuestion,
	} from './service';

	let database = $state<Awaited<ReturnType<typeof import('@/db/db').initDb>> | null>(null);
	let questions = $state<QuestionWithAnswers[]>([]);
	let loading = $state(true);

	let editingId = $state<string | null>(null);

	onMount(() => {
		return db.subscribe(async (d) => {
			if (d && !database) {
				database = d;
				await refreshQuestions();
			}
		});
	});

	async function refreshQuestions() {
		if (!database) return;
		loading = true;
		questions = await loadAllQuestionsWithAnswers(database);
		loading = false;
	}

	function startEdit(id: string) {
		editingId = id;
	}

	function startNew() {
		editingId = 'new';
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleSave(data: QuestionEditData) {
		if (!database) return;

		if (editingId === 'new') {
			await createQuestion(database, data);
			await refreshQuestions();
			editingId = null;
		} else if (editingId) {
			await updateQuestion(database, editingId, data);
			await refreshQuestions();
			editingId = null;
		}
	}

	async function handleDelete(id: string) {
		if (!database) return;
		await deleteQuestion(database, id);
		if (editingId === id) editingId = null;
		await refreshQuestions();
	}
</script>

<div class="questions-page">
	<div class="questions-header">
		<Heading level={2}>Pytania</Heading>
		<Button variant="primary" onclick={startNew}>+ Nowe pytanie</Button>
	</div>

	{#if loading}
		<Text variant="muted">Ładowanie...</Text>
	{:else}
		<div class="questions-list">
			{#if editingId === 'new'}
				<Card padding="lg">
					<QuestionEdit onsave={handleSave} oncancel={cancelEdit} />
				</Card>
			{/if}

			{#if questions.length === 0 && editingId !== 'new'}
				<Card padding="lg">
					<Text variant="muted">Brak pytań. Utwórz pierwsze!</Text>
				</Card>
			{/if}

			{#each questions as question (question.id)}
				<Card padding="lg">
					{#if editingId === question.id}
						<QuestionEdit {question} onsave={handleSave} oncancel={cancelEdit} />
					{:else}
						<QuestionDisplay
							{question}
							onedit={() => startEdit(question.id)}
							ondelete={() => handleDelete(question.id)}
						/>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</div>

<style>
	.questions-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
	}

	.questions-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
	}

	.questions-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-right: var(--space-1);
	}
</style>
