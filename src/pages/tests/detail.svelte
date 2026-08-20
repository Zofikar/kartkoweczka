<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Input from '@/lib/ui/Input.svelte';
	import ConfirmModal from '@/lib/ui/ConfirmModal.svelte';
	import SegmentedControl from '@/lib/ui/SegmentedControl.svelte';
	import PageHeader from '@/lib/ui/PageHeader.svelte';
	import QuestionFiltersBar from '@/lib/components/QuestionFiltersBar.svelte';
	import QuestionView from '@/lib/components/QuestionView.svelte';
	import EmptyState from '@/lib/components/EmptyState.svelte';
	import {
		createTest,
		deleteTest,
		deleteTestRevision,
		getTest,
		listQuestions,
		listTestRevisions,
		updateTest,
		type QuestionType,
		type QuestionWithAnswers,
		type TestRevisionSummary,
	} from '@/db/repositories';
	import { snackError, snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { getTags, initTags } from '@/lib/stores/tags.svelte';
	import { navigate, route } from '@/router';

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
		initTags();
	});

	$effect(() => {
		void initialize(testId);
	});

	async function initialize(id: string | null) {
		name = '';
		selectedIds = [];
		filterType = null;
		filterTags = [];
		filterTagMode = 'any';
		error = null;
		loaded = false;
		editMode = id === null;

		try {
			questionsLoading = true;
			allQuestions = await listQuestions();
			questionsLoading = false;

			if (id) {
				const test = await getTest(id);
				if (test) {
					name = test.name;
					selectedIds = test.questions.map((q) => q.id);
				}
				revisions = await listTestRevisions(id);
			} else {
				revisions = [];
			}

			originalName = name;
			originalSelectedIds = [...selectedIds];
		} catch (err) {
			snackError('Nie udało się wczytać testu');
			console.error('Failed to load test:', err);
		} finally {
			questionsLoading = false;
			loaded = true;
		}
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

	function toggleQuestion(id: string) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((qid) => qid !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	function toViewAnswers(question: QuestionWithAnswers) {
		return question.answers.map((a) => ({ key: a.id, content: a.content, isCorrect: a.isCorrect }));
	}

	async function submitSave() {
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
				const createdId = await createTest(data);
				snackSuccess('Test utworzony');
				editMode = false;
				await navigate('/tests/:id', { params: { id: createdId } });
			} else {
				await updateTest(testId!, data);
				snackSuccess('Test zaktualizowany');
				editMode = false;
				await navigate('/tests/:id', { params: { id: testId! } });
			}
		} catch (err) {
			snackError('Nie udało się zapisać testu.');
			console.error('Failed to save test:', err);
		} finally {
			saving = false;
		}
	}

	function requestDelete() {
		deleteConfirmOpen = true;
	}

	async function confirmDelete() {
		if (isNew) return;
		const id = testId!;
		deleteConfirmOpen = false;
		try {
			await deleteTest(id);
			snackSuccess('Test usunięty');
			await navigate('/tests');
		} catch (err) {
			console.error('Failed to delete test:', err);
			snackError('Nie udało się usunąć testu.');
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
		if (!revisionDeleteId) return;
		const id = revisionDeleteId;
		revisionDeleteId = null;
		revisionDeleteName = '';
		try {
			await deleteTestRevision(id);
			snackSuccess('Wersja usunięta');
			if (testId) revisions = await listTestRevisions(testId);
		} catch (err) {
			console.error('Failed to delete revision:', err);
			snackError('Nie udało się usunąć wersji.');
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

<svelte:head>
	<title>{isNew ? 'Nowy test' : name || 'Test'} – Kartkóweczka</title>
	<meta
		name="description"
		content="Twórz i edytuj testy w Kartkóweczce. Przypisuj pytania, generuj arkusze odpowiedzi i automatycznie oceniaj wyniki."
	/>
</svelte:head>

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
				<QuestionView
					type={question.type}
					content={question.content}
					answers={toViewAnswers(question)}
					tags={question.tags}
				/>
			</div>
		</label>
	</Card>
{/snippet}

{#snippet viewQuestionCard(question: QuestionWithAnswers)}
	<Card padding="md">
		<QuestionView
			type={question.type}
			content={question.content}
			answers={toViewAnswers(question)}
			tags={question.tags}
		/>
	</Card>
{/snippet}

<div class="detail-page">
	<PageHeader title={isNew ? 'Nowy test' : editMode ? 'Edytuj test' : name}>
		{#snippet actions()}
			{#if !isNew}
				<SegmentedControl
					role="tablist"
					aria-label="Tryb widoku"
					size="sm"
					value={editMode ? 'edit' : 'view'}
					options={[
						{ value: 'view', label: 'Podgląd' },
						{ value: 'edit', label: 'Edytuj' },
					]}
					onchange={(v) => (v === 'edit' ? (editMode = true) : requestSwitchToView())}
				/>

				{#if editMode}
					<Button variant="danger" size="sm" onclick={requestDelete}>Usuń</Button>
					<Button variant="primary" size="sm" onclick={submitSave} disabled={saving}>
						{saving ? 'Zapisywanie...' : 'Zapisz'}
					</Button>
				{:else}
					<Button
						variant="secondary"
						size="sm"
						onclick={() => navigate('/tests/:id/revision/new', { params: { id: testId! } })}
					>
						Utwórz wersję
					</Button>
				{/if}
			{/if}

			{#if isNew}
				<Button variant="primary" onclick={submitSave} disabled={saving}>
					{saving ? 'Zapisywanie...' : 'Utwórz test'}
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

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
							<QuestionFiltersBar bind:filterType bind:filterTags bind:filterTagMode {allTags} />

							{#if questionsLoading}
								<Text variant="muted">Ładowanie pytań...</Text>
							{:else if unselectedQuestions.length === 0}
								<EmptyState
									message={hasActiveFilters
										? 'Brak pytań spełniających kryteria filtrowania.'
										: 'Brak dostępnych pytań.'}
								/>
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
						<EmptyState message="Ten test nie ma przypisanych pytań." />
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
						<EmptyState message="Brak wersji. Utwórz pierwszą wersję testu." />
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

<ConfirmModal
	open={deleteConfirmOpen}
	oncancel={() => (deleteConfirmOpen = false)}
	title="Usuń test"
	confirmLabel="Usuń"
	onconfirm={confirmDelete}
>
	Czy na pewno chcesz usunąć ten test? Tej operacji nie można cofnąć.
</ConfirmModal>

<ConfirmModal
	open={revisionDeleteId !== null}
	oncancel={cancelDeleteRevision}
	title="Usuń wersję"
	confirmLabel="Usuń"
	onconfirm={confirmDeleteRevision}
>
	Czy na pewno chcesz usunąć wersję „{revisionDeleteName}"? Tej operacji nie można cofnąć.
</ConfirmModal>

<ConfirmModal
	open={discardConfirmOpen}
	oncancel={() => (discardConfirmOpen = false)}
	title="Niezapisane zmiany"
	confirmLabel="Odrzuć zmiany"
	onconfirm={confirmDiscard}
>
	Masz niezapisane zmiany. Przejście do podglądu spowoduje ich utratę.
</ConfirmModal>

<style>
	.detail-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
	}

	.detail-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-right: var(--space-1);
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
</style>
