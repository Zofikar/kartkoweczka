<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '@/db/dbStore';
	import Card from '@/lib/ui/Card.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import QuestionDisplay from '@/lib/components/QuestionDisplay.svelte';
	import QuestionEdit from '@/lib/components/QuestionEdit.svelte';
	import QuestionFiltersBar from '@/lib/components/QuestionFiltersBar.svelte';
	import EmptyState from '@/lib/components/EmptyState.svelte';
	import ConfirmModal from '@/lib/ui/ConfirmModal.svelte';
	import PageHeader from '@/lib/ui/PageHeader.svelte';
	import {
		createQuestion,
		deleteQuestion,
		loadAllQuestionsWithAnswers,
		loadFilteredQuestionsWithAnswers,
		loadQuestionById,
		type QuestionEditData,
		type QuestionFilters,
		type QuestionWithAnswers,
		updateQuestion,
	} from './service';
	import type { QuestionType } from '@/db/schema/types';
	import type { Database } from '@/db/db';
	import { snackError, snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { getTags, initTags, refreshTags } from '@/lib/stores/tags.svelte';

	let database = $state<Database | null>(null);
	let questions = $state<QuestionWithAnswers[]>([]);
	let loading = $state(true);

	let editingId = $state<string | null>(null);
	let isEditing = $derived(editingId !== null);

	// Filter state
	let filterType = $state<QuestionType | null>(null);
	let filterTags = $state<string[]>([]);
	let filterTagMode = $state<'any' | 'all'>('any');
	let hasActiveFilters = $derived(filterType !== null || filterTags.length > 0);
	let allTags = $derived(getTags());

	let deleteConfirmId = $state<string | null>(null);

	// Pinned question: the one currently being edited, always visible regardless of filters
	let pinnedQuestion = $state<QuestionWithAnswers | null>(null);

	// Display list: filtered questions + pinned question if not already present
	let displayQuestions = $derived(
		(() => {
			if (!pinnedQuestion) return questions;
			const alreadyInList = questions.some((q) => pinnedQuestion && q.id === pinnedQuestion.id);
			if (alreadyInList) return questions;
			return [pinnedQuestion, ...questions];
		})()
	);

	onMount(() => {
		const unsubTags = initTags();
		const unsubDb = db.subscribe(async (d) => {
			if (d && !database) {
				database = d;
				await refreshQuestions();
			}
		});
		return () => {
			unsubTags();
			unsubDb();
		};
	});

	async function refreshQuestions() {
		if (!database) return;
		loading = true;

		if (hasActiveFilters) {
			const filters: QuestionFilters = {};
			if (filterType) filters.type = filterType;
			if (filterTags.length > 0) {
				filters.tags = filterTags;
				filters.tagMode = filterTagMode;
			}
			questions = await loadFilteredQuestionsWithAnswers(database, filters);
		} else {
			questions = await loadAllQuestionsWithAnswers(database);
		}

		loading = false;
	}

	async function startEdit(id: string) {
		editingId = id;
		// Pin the question being edited so it stays visible even if filters would hide it
		const alreadyInList = questions.find((q) => q.id === id);
		if (alreadyInList) {
			pinnedQuestion = alreadyInList;
		} else if (database) {
			pinnedQuestion = await loadQuestionById(database, id);
		}
	}

	function startNew() {
		editingId = 'new';
		pinnedQuestion = null;
	}

	function cancelEdit() {
		editingId = null;
		pinnedQuestion = null;
	}

	async function handleSave(data: QuestionEditData) {
		if (!database) return;

		try {
			if (editingId === 'new') {
				await createQuestion(database, data);
				snackSuccess('Pytanie utworzone');
			} else if (editingId) {
				await updateQuestion(database, editingId, data);
				snackSuccess('Pytanie zaktualizowane');
			}
			await refreshTags(database);
			pinnedQuestion = null;
			await refreshQuestions();
			editingId = null;
		} catch (err) {
			snackError('Nie udało się zapisać pytania');
			console.error('Failed to save question:', err);
		}
	}

	function requestDelete(id: string) {
		deleteConfirmId = id;
	}

	async function confirmDelete() {
		if (!database || !deleteConfirmId) return;
		const id = deleteConfirmId;
		deleteConfirmId = null;
		try {
			await deleteQuestion(database, id);
			if (editingId === id) {
				editingId = null;
				pinnedQuestion = null;
			}
			await refreshTags(database);
			await refreshQuestions();
			snackSuccess('Pytanie usunięte');
		} catch (err) {
			snackError('Nie udało się usunąć pytania');
			console.error('Failed to delete question:', err);
		}
	}

	function cancelDelete() {
		deleteConfirmId = null;
	}
</script>

<div class="questions-page">
	<PageHeader title="Pytania">
		{#snippet actions()}
			<Button variant="primary" onclick={startNew} disabled={isEditing}>+ Nowe pytanie</Button>
		{/snippet}
	</PageHeader>

	<QuestionFiltersBar
		bind:filterType
		bind:filterTags
		bind:filterTagMode
		{allTags}
		onchange={refreshQuestions}
	/>

	{#if loading}
		<Text variant="muted">Ładowanie...</Text>
	{:else}
		<div class="questions-list">
			{#if editingId === 'new'}
				<Card padding="lg" active>
					<QuestionEdit onsave={handleSave} oncancel={cancelEdit} />
				</Card>
			{/if}

			{#if displayQuestions.length === 0 && editingId !== 'new'}
				{#if hasActiveFilters}
					<EmptyState message="Brak pytań spełniających kryteria filtrowania." />
				{:else}
					<EmptyState message="Brak pytań. Utwórz pierwsze!">
						{#snippet actions()}
							<Button variant="primary" onclick={startNew}>+ Nowe pytanie</Button>
						{/snippet}
					</EmptyState>
				{/if}
			{/if}

			{#each displayQuestions as question (question.id)}
				{@const isEdited = editingId === question.id}
				<Card padding="lg" active={isEdited}>
					{#if isEdited}
						<QuestionEdit {question} onsave={handleSave} oncancel={cancelEdit} />
					{:else}
						<QuestionDisplay
							{question}
							onedit={() => startEdit(question.id)}
							ondelete={() => requestDelete(question.id)}
							disableEdit={isEditing}
						/>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</div>

<ConfirmModal
	open={deleteConfirmId !== null}
	oncancel={cancelDelete}
	title="Usuń pytanie"
	confirmLabel="Usuń"
	onconfirm={confirmDelete}
>
	Czy na pewno chcesz usunąć to pytanie? Tej operacji nie można cofnąć.
</ConfirmModal>

<style>
	.questions-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
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
