<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '@/db/dbStore';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Select from '@/lib/ui/Select.svelte';
	import QuestionDisplay from '@/lib/components/QuestionDisplay.svelte';
	import QuestionEdit from '@/lib/components/QuestionEdit.svelte';
	import TagSelect from '@/lib/components/TagSelect.svelte';
	import Modal from '@/lib/ui/Modal.svelte';
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

	function clearFilters() {
		filterType = null;
		filterTags = [];
		filterTagMode = 'any';
		refreshQuestions();
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
	<div class="questions-header">
		<Heading level={2}>Pytania</Heading>
		<Button variant="primary" onclick={startNew} disabled={isEditing}>+ Nowe pytanie</Button>
	</div>

	<div class="filters-bar">
		<Select
			label="Typ pytania"
			size="md"
			bind:value={filterType}
			onchange={refreshQuestions}
			options={[
				{ value: null, label: 'Wszystkie' },
				{ value: 'choice', label: 'Jednokrotny wybór' },
				{ value: 'true_false', label: 'Prawda / Fałsz' },
			]}
		/>

		<div class="filter-group--tags">
			<TagSelect
				label="Tagi"
				size="md"
				selected={filterTags}
				{allTags}
				onselect={(tags) => {
					filterTags = tags;
					refreshQuestions();
				}}
			/>
		</div>

		<Select
			label="Tryb tagów"
			size="md"
			bind:value={filterTagMode}
			onchange={refreshQuestions}
			disabled={filterTags.length === 0}
			options={[
				{ value: 'any', label: 'Dowolny (ANY)' },
				{ value: 'all', label: 'Wszystkie (ALL)' },
			]}
		/>

		{#if hasActiveFilters}
			<Button variant="ghost" size="md" onclick={clearFilters}>Wyczyść filtry</Button>
		{/if}
	</div>

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
				<Card padding="lg">
					<Text variant="muted">
						{hasActiveFilters
							? 'Brak pytań spełniających kryteria filtrowania.'
							: 'Brak pytań. Utwórz pierwsze!'}
					</Text>
				</Card>
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

<Modal open={deleteConfirmId !== null} onclose={cancelDelete} title="Usuń pytanie">
	<p class="confirm-text">Czy na pewno chcesz usunąć to pytanie? Tej operacji nie można cofnąć.</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={cancelDelete}>Anuluj</Button>
		<Button variant="danger" onclick={confirmDelete}>Usuń</Button>
	{/snippet}
</Modal>

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

	.filters-bar {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.filter-group--tags {
		flex: 1;
		min-width: 200px;
		max-width: 400px;
	}

	.questions-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-right: var(--space-1);
	}

	.confirm-text {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		line-height: 1.5;
		margin: 0;
	}
</style>
