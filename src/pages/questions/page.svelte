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
	import {
		createQuestion,
		deleteQuestion,
		loadAllQuestionsWithAnswers,
		loadAllTags,
		loadFilteredQuestionsWithAnswers,
		type QuestionEditData,
		type QuestionFilters,
		type QuestionWithAnswers,
		updateQuestion,
	} from './service';
	import type { QuestionType } from '@/db/schema/types';

	let database = $state<Awaited<ReturnType<typeof import('@/db/db').initDb>> | null>(null);
	let questions = $state<QuestionWithAnswers[]>([]);
	let loading = $state(true);

	let editingId = $state<string | null>(null);
	let isEditing = $derived(editingId !== null);

	// Filter state
	let filterType = $state<QuestionType | null>(null);
	let filterTags = $state<string[]>([]);
	let filterTagMode = $state<'any' | 'all'>('any');
	let allTags = $state<string[]>([]);

	let hasActiveFilters = $derived(filterType !== null || filterTags.length > 0);

	onMount(() => {
		return db.subscribe(async (d) => {
			if (d && !database) {
				database = d;
				allTags = await loadAllTags(d);
				await refreshQuestions();
			}
		});
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
			allTags = await loadAllTags(database);
			await refreshQuestions();
			editingId = null;
		} else if (editingId) {
			await updateQuestion(database, editingId, data);
			allTags = await loadAllTags(database);
			await refreshQuestions();
			editingId = null;
		}
	}

	async function handleDelete(id: string) {
		if (!database) return;
		await deleteQuestion(database, id);
		if (editingId === id) editingId = null;
		allTags = await loadAllTags(database);
		await refreshQuestions();
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
				<Card padding="lg">
					<QuestionEdit onsave={handleSave} oncancel={cancelEdit} />
				</Card>
			{/if}

			{#if questions.length === 0 && editingId !== 'new'}
				<Card padding="lg">
					<Text variant="muted">
						{hasActiveFilters
							? 'Brak pytań spełniających kryteria filtrowania.'
							: 'Brak pytań. Utwórz pierwsze!'}
					</Text>
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
							disableEdit={isEditing}
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
</style>
