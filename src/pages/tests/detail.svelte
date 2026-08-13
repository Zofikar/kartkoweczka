<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '@/db/dbStore';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Input from '@/lib/ui/Input.svelte';
	import Select from '@/lib/ui/Select.svelte';
	import Badge from '@/lib/ui/Badge.svelte';
	import Modal from '@/lib/ui/Modal.svelte';
	import TagSelect from '@/lib/components/TagSelect.svelte';
	import { loadAllQuestionsWithAnswers, type QuestionWithAnswers } from '../questions/service';
	import {
		createTest,
		deleteTest,
		deleteTestRevision,
		loadTestById,
		loadTestRevisions,
		updateTest,
		type TestRevisionSummary,
	} from './service';
	import type { QuestionType } from '@/db/schema/types';
	import type { Database } from '@/db/db';
	import { snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { getTags, initTags } from '@/lib/stores/tags.svelte';
	import { renderDocumentToHtml } from '@/utils/math';
	import { navigate, route } from '@/router';

	let database = $state<Database | null>(null);

	// Test being edited, or null when creating a new one
	let testId = $derived(route.params.id ?? null);
	let isNew = $derived(testId === null);

	let name = $state('');
	let selectedIds = $state<string[]>([]);
	let originalName = $state('');
	let originalSelectedIds = $state<string[]>([]);
	let allQuestions = $state<QuestionWithAnswers[]>([]);
	let questionsLoading = $state(false);
	let loaded = $state(false);
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Default to view mode for existing tests; new tests open in edit mode.
	let editMode = $state(false);

	// Question selection filters (same as questions page)
	let filterType = $state<QuestionType | null>(null);
	let filterTags = $state<string[]>([]);
	let filterTagMode = $state<'any' | 'all'>('any');
	let hasActiveFilters = $derived(filterType !== null || filterTags.length > 0);
	let allTags = $derived(getTags());

	// Selected questions are kept in selection order and shown in their own section.
	let selectedQuestions = $derived(
		selectedIds
			.map((id) => allQuestions.find((q) => q.id === id))
			.filter((q): q is QuestionWithAnswers => q !== undefined)
	);

	// Non-selected questions, with the same filters as the questions page.
	let unselectedQuestions = $derived(
		allQuestions.filter((q) => {
			if (selectedIds.includes(q.id)) return false;
			if (filterType && q.type !== filterType) return false;
			if (filterTags.length > 0) {
				if (filterTagMode === 'all') {
					return filterTags.every((t) => q.tags.includes(t));
				}
				return filterTags.some((t) => q.tags.includes(t));
			}
			return true;
		})
	);

	let unselectedCollapsed = $state(true);
	let deleteConfirmOpen = $state(false);
	let revisions = $state<TestRevisionSummary[]>([]);
	let revisionDeleteId = $state<string | null>(null);
	let revisionDeleteName = $state('');
	let discardConfirmOpen = $state(false);
	let isDirty = $derived(name !== originalName || !sameIds(selectedIds, originalSelectedIds));

	onMount(() => {
		const unsubTags = initTags();
		const unsubDb = db.subscribe((d) => {
			if (d) database = d;
		});
		return () => {
			unsubTags();
			unsubDb();
		};
	});

	$effect(() => {
		if (!database) return;
		initialize(testId);
	});

	async function initialize(id: string | null) {
		if (!database) return;

		name = '';
		selectedIds = [];
		filterType = null;
		filterTags = [];
		filterTagMode = 'any';
		error = null;
		loaded = false;
		editMode = id === null;

		questionsLoading = true;
		allQuestions = await loadAllQuestionsWithAnswers(database);
		questionsLoading = false;

		if (id) {
			const test = await loadTestById(database, id);
			if (test) {
				name = test.name;
				selectedIds = test.questions.map((q) => q.id);
			}
			revisions = await loadTestRevisions(database, id);
		} else {
			revisions = [];
		}

		originalName = name;
		originalSelectedIds = [...selectedIds];

		loaded = true;
	}

	function sameIds(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		return a.every((id, i) => id === b[i]);
	}

	function requestSwitchToView() {
		if (isDirty) {
			discardConfirmOpen = true;
		} else {
			editMode = false;
		}
	}

	function confirmDiscard() {
		name = originalName;
		selectedIds = [...originalSelectedIds];
		discardConfirmOpen = false;
		editMode = false;
	}

	function clearFilters() {
		filterType = null;
		filterTags = [];
		filterTagMode = 'any';
	}

	function toggleQuestion(id: string) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((qid) => qid !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	async function submitSave() {
		if (!database) return;

		if (!name.trim()) {
			error = 'Nazwa testu jest wymagana.';
			return;
		}

		if (selectedIds.length === 0) {
			error = 'Przypisz co najmniej jedno pytanie.';
			return;
		}

		saving = true;
		error = null;
		try {
			const data = { name: name.trim(), questionIds: selectedIds };
			if (isNew) {
				const createdId = await createTest(database, data);
				snackSuccess('Test utworzony');
				editMode = false;
				await navigate('/tests/:id', { params: { id: createdId } });
			} else {
				await updateTest(database, testId!, data);
				snackSuccess('Test zaktualizowany');
				editMode = false;
				await navigate('/tests/:id', { params: { id: testId! } });
			}
		} catch (err) {
			error = 'Nie udało się zapisać testu.';
			console.error('Failed to save test:', err);
		} finally {
			saving = false;
		}
	}

	function requestDelete() {
		deleteConfirmOpen = true;
	}

	async function confirmDelete() {
		if (!database || isNew) return;
		const id = testId!;
		deleteConfirmOpen = false;
		try {
			await deleteTest(database, id);
			snackSuccess('Test usunięty');
			await navigate('/tests');
		} catch (err) {
			console.error('Failed to delete test:', err);
			error = 'Nie udało się usunąć testu.';
		}
	}

	function requestDeleteRevision(id: string, revisionName: string) {
		revisionDeleteId = id;
		revisionDeleteName = revisionName;
	}

	function cancelDeleteRevision() {
		revisionDeleteId = null;
		revisionDeleteName = '';
	}

	async function confirmDeleteRevision() {
		if (!database || !revisionDeleteId) return;
		const id = revisionDeleteId;
		revisionDeleteId = null;
		revisionDeleteName = '';
		try {
			await deleteTestRevision(database, id);
			snackSuccess('Wersja usunięta');
			if (testId) revisions = await loadTestRevisions(database, testId);
		} catch (err) {
			console.error('Failed to delete revision:', err);
			error = 'Nie udało się usunąć wersji.';
		}
	}

	function openRevision(revisionId: string) {
		if (testId) {
			navigate('/tests/:id/revision/:revisionId', {
				params: { id: testId, revisionId },
			});
		}
	}
</script>

{#snippet questionCard(question: QuestionWithAnswers)}
	<Card padding="md" active={selectedIds.includes(question.id)}>
		<label class="question-select-row">
			<input
				type="checkbox"
				class="question-checkbox"
				checked={selectedIds.includes(question.id)}
				onchange={() => toggleQuestion(question.id)}
			/>
			<div class="question-select-content">
				<div class="question-select-meta">
					<Badge variant="accent">
						{question.type === 'choice' ? 'Jednokrotny wybór' : 'Prawda / Fałsz'}
					</Badge>
					{#if question.tags && question.tags.length > 0}
						{#each question.tags as tag (tag)}
							<Badge variant="secondary" size="sm">{tag}</Badge>
						{/each}
					{/if}
				</div>
				<div class="question-select-text">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html renderDocumentToHtml(question.content)}
				</div>
			</div>
		</label>
	</Card>
{/snippet}

{#snippet viewQuestionCard(question: QuestionWithAnswers)}
	<Card padding="md">
		<div class="view-question">
			<div class="question-select-meta">
				<Badge variant="accent">
					{question.type === 'choice' ? 'Jednokrotny wybór' : 'Prawda / Fałsz'}
				</Badge>
				{#if question.tags && question.tags.length > 0}
					{#each question.tags as tag (tag)}
						<Badge variant="secondary" size="sm">{tag}</Badge>
					{/each}
				{/if}
			</div>
			<div class="question-select-text">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html renderDocumentToHtml(question.content)}
			</div>
			<ul class="view-answers-list">
				{#each question.answers as answer (answer.id)}
					<li class="view-answer" class:correct={answer.isCorrect}>
						<span class="answer-order-mark" class:correct={answer.isCorrect}>
							{answer.isCorrect ? '✓' : '✗'}
						</span>
						<span class="question-select-text">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html renderDocumentToHtml(answer.content)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</Card>
{/snippet}

<div class="detail-page">
	<div class="detail-header">
		<Heading level={2}>{isNew ? 'Nowy test' : editMode ? 'Edytuj test' : name}</Heading>
		<div class="detail-header-actions">
			{#if !isNew}
				<div class="mode-switch" role="tablist" aria-label="Tryb widoku">
					<Button variant={editMode ? 'ghost' : 'primary'} size="sm" onclick={requestSwitchToView}>
						Podgląd
					</Button>
					<Button
						variant={editMode ? 'primary' : 'ghost'}
						size="sm"
						onclick={() => (editMode = true)}
					>
						Edytuj
					</Button>
				</div>

				<Button
					variant="secondary"
					size="sm"
					onclick={() => navigate('/tests/:id/revision/new', { params: { id: testId! } })}
				>
					Utwórz wersję
				</Button>
				{#if editMode}
					<Button variant="danger" size="sm" onclick={requestDelete}>Usuń</Button>
					<Button variant="primary" size="sm" onclick={submitSave} disabled={saving}>
						{saving ? 'Zapisywanie...' : 'Zapisz'}
					</Button>
				{/if}
			{/if}

			{#if isNew}
				<Button variant="primary" onclick={submitSave} disabled={saving}>
					{saving ? 'Zapisywanie...' : 'Utwórz test'}
				</Button>
			{/if}
		</div>
	</div>

	{#if !loaded}
		<Text variant="muted">Ładowanie...</Text>
	{:else}
		<div class="detail-body">
			{#if editMode}
				<Input
					label="Nazwa testu"
					bind:value={name}
					placeholder="np. Kartkówka z matematyki"
					error={error ?? undefined}
					oninput={() => (error = null)}
				/>

				<div class="filters-bar">
					<Select
						label="Typ pytania"
						size="md"
						bind:value={filterType}
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
							onselect={(tags) => (filterTags = tags)}
						/>
					</div>

					<Select
						label="Tryb tagów"
						size="md"
						bind:value={filterTagMode}
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

				<div class="selection-area">
					<div class="selection-header">
						<Text variant="body">
							Wybrano <strong>{selectedIds.length}</strong> pytań
						</Text>
					</div>

					{#if selectedQuestions.length > 0}
						<section class="selection-section">
							<Heading level={4}>Wybrane pytania</Heading>
							<div class="question-select-list">
								{#each selectedQuestions as question (question.id)}
									{@render questionCard(question)}
								{/each}
							</div>
						</section>
					{/if}

					<section class="selection-section">
						<button
							type="button"
							class="collapse-toggle"
							aria-expanded={!unselectedCollapsed}
							onclick={() => (unselectedCollapsed = !unselectedCollapsed)}
						>
							<span class="section-title">Dostępne pytania</span>
							<span class="collapse-count">{unselectedQuestions.length}</span>
							<span class="collapse-arrow" aria-hidden="true">
								{unselectedCollapsed ? '▸' : '▾'}
							</span>
						</button>

						{#if !unselectedCollapsed}
							{#if questionsLoading}
								<Text variant="muted">Ładowanie pytań...</Text>
							{:else if unselectedQuestions.length === 0}
								<Card padding="lg">
									<Text variant="muted">
										{hasActiveFilters
											? 'Brak pytań spełniających kryteria filtrowania.'
											: 'Brak dostępnych pytań.'}
									</Text>
								</Card>
							{:else}
								<div class="question-select-list">
									{#each unselectedQuestions as question (question.id)}
										{@render questionCard(question)}
									{/each}
								</div>
							{/if}
						{/if}
					</section>
				</div>
			{:else}
				<section class="selection-section">
					<Heading level={4}>Pytania</Heading>

					{#if selectedQuestions.length === 0}
						<Text variant="muted">Ten test nie ma przypisanych pytań.</Text>
					{:else}
						<div class="question-select-list">
							{#each selectedQuestions as question (question.id)}
								{@render viewQuestionCard(question)}
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			{#if !isNew}
				<section class="selection-section">
					<Heading level={4}>Wersje testu</Heading>

					{#if revisions.length === 0}
						<Text variant="muted">Brak wersji. Utwórz pierwszą wersję testu.</Text>
					{:else}
						<div class="revision-list">
							{#each revisions as revision (revision.id)}
								<div
									class="revision-card-button"
									role="button"
									tabindex="0"
									onclick={() => openRevision(revision.id)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											openRevision(revision.id);
										}
									}}
								>
									<Card padding="md">
										<div class="revision-row">
											<div class="revision-info">
												<Heading level={5}>{revision.name}</Heading>
												<Text variant="small">
													{revision.createdAt.toLocaleString()}
												</Text>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onclick={(e) => {
													e.stopPropagation();
													requestDeleteRevision(revision.id, revision.name);
												}}
											>
												Usuń
											</Button>
										</div>
									</Card>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</div>

<Modal open={deleteConfirmOpen} onclose={() => (deleteConfirmOpen = false)} title="Usuń test">
	<p class="confirm-text">Czy na pewno chcesz usunąć ten test? Tej operacji nie można cofnąć.</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (deleteConfirmOpen = false)}>Anuluj</Button>
		<Button variant="danger" onclick={confirmDelete}>Usuń</Button>
	{/snippet}
</Modal>

<Modal open={revisionDeleteId !== null} onclose={cancelDeleteRevision} title="Usuń wersję">
	<p class="confirm-text">
		Czy na pewno chcesz usunąć wersję „{revisionDeleteName}"? Tej operacji nie można cofnąć.
	</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={cancelDeleteRevision}>Anuluj</Button>
		<Button variant="danger" onclick={confirmDeleteRevision}>Usuń</Button>
	{/snippet}
</Modal>

<Modal
	open={discardConfirmOpen}
	onclose={() => (discardConfirmOpen = false)}
	title="Niezapisane zmiany"
>
	<p class="confirm-text">Masz niezapisane zmiany. Przejście do podglądu spowoduje ich utratę.</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (discardConfirmOpen = false)}>Anuluj</Button>
		<Button variant="danger" onclick={confirmDiscard}>Odrzuć zmiany</Button>
	{/snippet}
</Modal>

<style>
	.detail-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-shrink: 0;
	}

	.detail-header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.mode-switch {
		display: inline-flex;
		gap: var(--space-1);
		border: var(--control-border-w) solid var(--background-muted);
		border-radius: var(--control-radius);
		padding: 2px;
	}

	.detail-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-right: var(--space-1);
	}

	.filters-bar {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.filter-group--tags {
		flex: 1;
		min-width: 200px;
		max-width: 400px;
	}

	.selection-area {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.selection-header {
		flex-shrink: 0;
	}

	.selection-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.collapse-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		color: inherit;
		text-align: left;
	}

	.collapse-toggle:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.section-title {
		font-family: var(--font-sans);
		font-size: var(--font-lg);
		font-weight: var(--font-semibold);
		color: var(--text);
		line-height: 1.2;
	}

	.collapse-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background-color: var(--background-muted);
		color: var(--text-muted);
		font-size: var(--font-xs);
		font-weight: var(--font-medium);
	}

	.collapse-arrow {
		color: var(--text-muted);
		font-size: var(--font-sm);
	}

	.question-select-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.question-select-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		cursor: pointer;
	}

	.question-checkbox {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		accent-color: var(--primary);
		cursor: pointer;
		flex-shrink: 0;
	}

	.question-select-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
		flex: 1;
	}

	.question-select-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		align-items: center;
	}

	.question-select-text {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.view-question {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.view-answers-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.view-answer {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		background-color: var(--background);
		border: 1px solid var(--background-muted);
	}

	.view-answer.correct {
		border-color: var(--primary);
		background-color: color-mix(in srgb, var(--primary) 10%, var(--background));
	}

	.answer-order-mark {
		font-size: var(--font-sm);
		font-weight: var(--font-bold);
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.answer-order-mark.correct {
		color: var(--success);
	}

	.revision-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.revision-card-button {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: inherit;
	}

	.revision-card-button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--radius-md);
	}

	.revision-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.revision-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.confirm-text {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		line-height: 1.5;
		margin: 0;
	}
</style>
