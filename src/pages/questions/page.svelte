<script lang="ts">
	import { onMount } from 'svelte';
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
		getQuestion,
		listQuestions,
		updateQuestion,
		type QuestionEditData,
		type QuestionFilters,
		type QuestionType,
		type QuestionWithAnswers,
	} from '@/db/repositories';
	import { snackError, snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { getTags, initTags } from '@/lib/stores/tags.svelte';
	import { i18n } from '@/lib/i18n.svelte';

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
		initTags();
		void refreshQuestions();
	});

	async function refreshQuestions() {
		loading = true;

		try {
			const filters: QuestionFilters = {};
			if (filterType) filters.type = filterType;
			if (filterTags.length > 0) {
				filters.tags = filterTags;
				filters.tagMode = filterTagMode;
			}
			questions = await listQuestions(filters);
		} catch (err) {
			snackError(i18n.t('questions.loadError'));
			console.error('Failed to load questions:', err);
		} finally {
			loading = false;
		}
	}

	async function startEdit(id: string) {
		editingId = id;
		// Pin the question being edited so it stays visible even if filters would hide it
		const alreadyInList = questions.find((q) => q.id === id);
		if (alreadyInList) {
			pinnedQuestion = alreadyInList;
			return;
		}
		try {
			pinnedQuestion = await getQuestion(id);
			if (!pinnedQuestion) {
				snackError(i18n.t('questions.notFound'));
				editingId = null;
			}
		} catch (err) {
			snackError(i18n.t('questions.loadOneError'));
			console.error('Failed to load question:', err);
			editingId = null;
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
		try {
			if (editingId === 'new') {
				await createQuestion(data);
				snackSuccess(i18n.t('questions.created'));
			} else if (editingId) {
				await updateQuestion(editingId, data);
				snackSuccess(i18n.t('questions.updated'));
			}
			pinnedQuestion = null;
			await refreshQuestions();
			editingId = null;
		} catch (err) {
			snackError(i18n.t('questions.saveError'));
			console.error('Failed to save question:', err);
		}
	}

	function requestDelete(id: string) {
		deleteConfirmId = id;
	}

	async function confirmDelete() {
		if (!deleteConfirmId) return;
		const id = deleteConfirmId;
		deleteConfirmId = null;
		try {
			await deleteQuestion(id);
			if (editingId === id) {
				editingId = null;
				pinnedQuestion = null;
			}
			await refreshQuestions();
			snackSuccess(i18n.t('questions.deleted'));
		} catch (err) {
			snackError(i18n.t('questions.deleteError'));
			console.error('Failed to delete question:', err);
		}
	}

	function cancelDelete() {
		deleteConfirmId = null;
	}
</script>

<svelte:head>
	<title>{i18n.t('questions.pageTitle')}</title>
	<meta name="description" content={i18n.t('questions.description')} />
</svelte:head>

<div class="questions-page">
	<PageHeader title={i18n.t('questions.title')}>
		{#snippet actions()}
			<Button variant="primary" onclick={startNew} disabled={isEditing}
				>{i18n.t('questions.new')}</Button
			>
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
		<Text variant="muted">{i18n.t('common.loading')}</Text>
	{:else}
		<div class="questions-list">
			{#if editingId === 'new'}
				<Card padding="lg" active>
					<QuestionEdit onsave={handleSave} oncancel={cancelEdit} />
				</Card>
			{/if}

			{#if displayQuestions.length === 0 && editingId !== 'new'}
				{#if hasActiveFilters}
					<EmptyState message={i18n.t('questions.emptyFiltered')} />
				{:else}
					<EmptyState message={i18n.t('questions.empty')}>
						{#snippet actions()}
							<Button variant="primary" onclick={startNew}>{i18n.t('questions.new')}</Button>
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
	title={i18n.t('questions.deleteTitle')}
	confirmLabel={i18n.t('common.delete')}
	onconfirm={confirmDelete}
>
	{i18n.t('questions.deletePrompt')}
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
