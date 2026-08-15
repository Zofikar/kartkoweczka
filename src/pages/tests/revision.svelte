<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '@/lib/ui/Card.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Badge from '@/lib/ui/Badge.svelte';
	import ConfirmModal from '@/lib/ui/ConfirmModal.svelte';
	import SegmentedControl from '@/lib/ui/SegmentedControl.svelte';
	import PageHeader from '@/lib/ui/PageHeader.svelte';
	import PrintTestSheets from '@/lib/components/PrintTestSheets.svelte';
	import QuestionView from '@/lib/components/QuestionView.svelte';
	import OrderControls from '@/lib/components/OrderControls.svelte';
	import { questionTypeLabel } from '@/lib/labels';
	import {
		createTestRevision,
		generateNextRevisionName,
		getTest,
		getTestRevision,
		updateTestRevision,
		type QuestionWithAnswers,
		type SnapshotQuestion,
	} from '@/db/repositories';
	import type { EditableQuestion } from '@/lib/types';
	import { snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { initTags } from '@/lib/stores/tags.svelte';
	import { renderDocumentToHtml } from '@/utils/math';
	import { navigate, route } from '@/router';

	let testId = $derived(route.params.id ?? null);
	let revisionId = $derived(route.params.revisionId ?? null);
	let isNew = $derived(revisionId === null);

	let name = $state('');
	let testName = $state('');
	let questions = $state<EditableQuestion[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Default to view mode for existing revisions; new revisions open in edit mode.
	let editMode = $state(false);

	let autoOrder = $state(true);
	let autoMangle = $state(true);
	let confirmOpen = $state(false);
	let printOpen = $state(false);

	let originalQuestions = $state<EditableQuestion[]>([]);
	let originalAutoOrder = $state(true);
	let originalAutoMangle = $state(true);
	let discardConfirmOpen = $state(false);
	let isDirty = $derived(
		JSON.stringify(questions) !== JSON.stringify(originalQuestions) ||
			autoOrder !== originalAutoOrder ||
			autoMangle !== originalAutoMangle
	);

	onMount(() => {
		initTags();
	});

	$effect(() => {
		void initialize();
	});

	async function initialize() {
		if (!testId) return;

		name = '';
		testName = '';
		questions = [];
		error = null;
		loading = true;
		editMode = revisionId === null;

		try {
			const test = await getTest(testId);
			if (test) testName = test.name;

			if (revisionId) {
				const revision = await getTestRevision(revisionId);
				if (revision) {
					name = revision.name;
					questions = revision.content.map(toEditableQuestion);
				}
			} else {
				if (test) {
					name = await generateNextRevisionName(testId);
					questions = test.questions.map(toQuestion);
				}
			}

			originalQuestions = cloneQuestions(questions);
			originalAutoOrder = autoOrder;
			originalAutoMangle = autoMangle;
		} catch (err) {
			error = 'Nie udało się wczytać danych.';
			console.error('Failed to load revision:', err);
		} finally {
			loading = false;
		}
	}

	function cloneQuestions(list: EditableQuestion[]): EditableQuestion[] {
		return list.map((q) => ({
			...q,
			answers: q.answers.map((a) => ({ ...a })),
		}));
	}

	function requestSwitchToView() {
		if (isDirty) {
			discardConfirmOpen = true;
		} else {
			editMode = false;
		}
	}

	function confirmDiscard() {
		questions = cloneQuestions(originalQuestions);
		autoOrder = originalAutoOrder;
		autoMangle = originalAutoMangle;
		discardConfirmOpen = false;
		editMode = false;
	}

	function toQuestion(question: QuestionWithAnswers): EditableQuestion {
		return {
			key: question.id,
			type: question.type,
			content: question.content,
			image: question.image,
			imageHeight: question.imageHeight,
			imagePlacement: question.imagePlacement,
			answers: question.answers.map((answer) => ({
				key: answer.id,
				content: answer.content,
				isCorrect: answer.isCorrect,
			})),
		};
	}

	function toEditableQuestion(question: SnapshotQuestion, index: number): EditableQuestion {
		return {
			key: `q-${index}`,
			type: question.type,
			content: question.content,
			image: question.image ?? null,
			imageHeight: question.imageHeight ?? null,
			imagePlacement: question.imagePlacement ?? null,
			answers: question.answers.map((answer, answerIndex) => ({
				key: `a-${index}-${answerIndex}`,
				content: answer.content,
				isCorrect: answer.is_correct,
			})),
		};
	}

	function moveQuestion(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= questions.length) return;
		questions = questions.map((q, i) => {
			if (i === index) return questions[target];
			if (i === target) return questions[index];
			return q;
		});
	}

	function moveAnswer(questionKey: string, index: number, direction: -1 | 1) {
		questions = questions.map((q) => {
			if (q.key !== questionKey) return q;
			const answers = [...q.answers];
			const target = index + direction;
			if (target < 0 || target >= answers.length) return q;
			[answers[index], answers[target]] = [answers[target], answers[index]];
			return { ...q, answers };
		});
	}

	function shuffle<T>(items: T[]): T[] {
		const copy = [...items];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	function buildSnapshot(): SnapshotQuestion[] {
		let ordered = [...questions];
		if (isNew && autoOrder) ordered = shuffle(ordered);

		return ordered.map((question) => {
			let answers = [...question.answers];
			if (isNew && autoMangle) answers = shuffle(answers);

			return {
				type: question.type,
				content: question.content,
				image: question.image,
				imageHeight: question.imageHeight,
				imagePlacement: question.imagePlacement,
				answers: answers.map((a) => ({
					content: a.content,
					is_correct: a.isCorrect,
				})),
			};
		});
	}

	async function submit() {
		if (!testId) return;

		if (questions.length === 0) {
			error = 'Test musi zawierać co najmniej jedno pytanie.';
			return;
		}

		// Editing an existing revision may invalidate already printed cards,
		// so require a confirmation with an option to save as a new revision.
		if (!isNew) {
			confirmOpen = true;
			return;
		}

		await doSave(false);
	}

	async function doSave(saveAsNew: boolean) {
		if (!testId) return;

		confirmOpen = false;
		saving = true;
		error = null;
		try {
			const finalName = saveAsNew ? await generateNextRevisionName(testId) : name;
			const data = { name: finalName, questions: buildSnapshot() };
			if (isNew || saveAsNew) {
				const createdId = await createTestRevision(testId, data);
				snackSuccess(saveAsNew ? 'Utworzono nową wersję' : 'Wersja utworzona');
				await navigate('/tests/:id/revision/:revisionId', {
					params: { id: testId, revisionId: createdId },
				});
			} else {
				await updateTestRevision(revisionId!, data);
				snackSuccess('Wersja zaktualizowana');
				editMode = false;
				await navigate('/tests/:id/revision/:revisionId', {
					params: { id: testId, revisionId: revisionId! },
				});
			}
		} catch (err) {
			error = 'Nie udało się zapisać wersji.';
			console.error('Failed to save revision:', err);
		} finally {
			saving = false;
		}
	}

	function goBack() {
		if (testId) {
			navigate('/tests/:id', { params: { id: testId } });
		} else {
			navigate('/tests');
		}
	}
</script>

{#snippet viewQuestionCard(question: EditableQuestion, index: number)}
	<Card padding="md">
		<QuestionView
			type={question.type}
			content={question.content}
			answers={question.answers}
			{index}
		/>
	</Card>
{/snippet}

<div class="revision-page">
	<PageHeader title={isNew ? 'Nowa wersja' : editMode ? 'Edytuj wersję' : name}>
		{#snippet leading()}
			<Button variant="ghost" onclick={goBack}>← Wstecz</Button>
		{/snippet}
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
			{/if}

			{#if editMode}
				<Button variant="primary" onclick={submit} disabled={saving}>
					{saving ? 'Zapisywanie...' : isNew ? 'Utwórz wersję' : 'Zapisz zmiany'}
				</Button>
			{:else}
				<Button variant="secondary" onclick={() => (printOpen = true)}>Drukuj</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if loading}
		<Text variant="muted">Ładowanie...</Text>
	{:else}
		<Card padding="lg">
			<div class="revision-form">
				<div class="revision-name-display">
					<Text variant="small">Nazwa wersji</Text>
					<Heading level={4}>{name}</Heading>
				</div>

				{#if error}
					<Text variant="error">{error}</Text>
				{/if}

				{#if editMode}
					{#if isNew}
						<div class="revision-settings">
							<label class="setting-row">
								<input type="checkbox" bind:checked={autoOrder} />
								<span class="setting-label">Losuj kolejność pytań</span>
								<span class="setting-hint">
									{autoOrder ? 'Pytania zostaną losowo przetasowane.' : 'Ustaw kolejność ręcznie.'}
								</span>
							</label>

							<label class="setting-row">
								<input type="checkbox" bind:checked={autoMangle} />
								<span class="setting-label">Losuj kolejność odpowiedzi</span>
								<span class="setting-hint">
									{autoMangle
										? 'Odpowiedzi zostaną losowo przetasowane.'
										: 'Ustaw kolejność odpowiedzi ręcznie.'}
								</span>
							</label>
						</div>
					{/if}

					<div class="question-order-list">
						{#each questions as question, index (question.key)}
							<Card padding="md">
								<div class="ordered-question">
									<div class="ordered-question-header">
										<div class="ordered-question-info">
											<span class="order-badge">{index + 1}</span>
											<Badge variant="accent">
												{questionTypeLabel(question.type)}
											</Badge>
											<div class="question-text">
												<!-- eslint-disable-next-line svelte/no-at-html-tags -->
												{@html renderDocumentToHtml(question.content)}
											</div>
										</div>

										{#if !isNew || !autoOrder}
											<OrderControls
												itemLabel="pytanie"
												disableUp={index === 0}
												disableDown={index === questions.length - 1}
												onmove={(dir) => moveQuestion(index, dir)}
											/>
										{/if}
									</div>

									{#if !isNew || !autoMangle}
										<div class="answer-order-list">
											{#each question.answers as answer, answerIndex (answer.key)}
												<div class="answer-order-row">
													<span class="answer-index-badge">{answerIndex + 1}</span>
													<span class="answer-order-mark" class:correct={answer.isCorrect}>
														{answer.isCorrect ? '✓' : '✗'}
													</span>
													<span class="answer-order-text">
														<!-- eslint-disable-next-line svelte/no-at-html-tags -->
														{@html renderDocumentToHtml(answer.content)}
													</span>
													<OrderControls
														itemLabel="odpowiedź"
														disableUp={answerIndex === 0}
														disableDown={answerIndex === question.answers.length - 1}
														onmove={(dir) => moveAnswer(question.key, answerIndex, dir)}
													/>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</Card>
						{/each}
					</div>
				{:else}
					<div class="question-order-list">
						{#each questions as question, index (question.key)}
							{@render viewQuestionCard(question, index)}
						{/each}
					</div>
				{/if}
			</div>
		</Card>
	{/if}
</div>

<PrintTestSheets
	open={printOpen}
	onclose={() => (printOpen = false)}
	{testName}
	revisionName={name}
	revisionId={revisionId ?? undefined}
	questions={buildSnapshot()}
/>

<ConfirmModal
	open={discardConfirmOpen}
	oncancel={() => (discardConfirmOpen = false)}
	title="Niezapisane zmiany"
	confirmLabel="Odrzuć zmiany"
	onconfirm={confirmDiscard}
>
	Masz niezapisane zmiany. Przejście do podglądu spowoduje ich utratę.
</ConfirmModal>

<ConfirmModal
	open={confirmOpen}
	oncancel={() => (confirmOpen = false)}
	title="Zapisz zmiany wersji"
>
	Ta wersja mogła już zostać wydrukowana. Nadpisanie jej zmieni dopasowanie odpowiedzi na kartach.
	Wybierz, czy chcesz nadpisać istniejącą wersję, czy utworzyć nową na podstawie zmian.
	{#snippet actions()}
		<Button variant="ghost" onclick={() => (confirmOpen = false)}>Anuluj</Button>
		<Button variant="outline" onclick={() => doSave(true)}>Zapisz jako nową wersję</Button>
		<Button variant="danger" onclick={() => doSave(false)}>Nadpisz wersję</Button>
	{/snippet}
</ConfirmModal>

<style>
	.revision-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-4);
	}

	.revision-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.revision-name-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.revision-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.setting-row {
		display: grid;
		grid-template-columns: auto auto 1fr;
		align-items: center;
		gap: var(--space-3);
		cursor: pointer;
	}

	.setting-row input[type='checkbox'] {
		width: 20px;
		height: 20px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.setting-label {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		font-weight: var(--font-medium);
		color: var(--text);
		white-space: nowrap;
	}

	.setting-hint {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.question-order-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.ordered-question {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.ordered-question-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.ordered-question-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}

	.question-text {
		font-family: var(--font-sans);
		font-size: var(--font-lg);
		font-weight: var(--font-semibold);
		color: var(--text);
		line-height: 1.6;
		white-space: pre-wrap;
		/* Align bare text with the text inside the padded badge/box elements. */
		padding-left: var(--space-3);
	}

	.order-badge {
		width: 24px;
		height: 24px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		background-color: var(--primary);
		color: var(--primary-text);
		font-size: var(--font-xs);
		font-weight: var(--font-bold);
		flex-shrink: 0;
	}

	.answer-order-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border-left: 2px solid var(--background-muted);
		padding-left: var(--space-3);
	}

	.answer-order-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.answer-index-badge {
		width: 20px;
		height: 20px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		/* Page-colored fill so the circle stays visible on muted card backgrounds. */
		background-color: var(--background);
		color: var(--text-muted);
		font-size: var(--font-xs);
		font-weight: var(--font-medium);
		flex-shrink: 0;
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

	.answer-order-text {
		flex: 1;
		min-width: 0;
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}
</style>
