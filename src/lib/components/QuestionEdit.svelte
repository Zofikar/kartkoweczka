<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import IconButton from '@/lib/ui/IconButton.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import type {
		ImagePlacement,
		QuestionEditData,
		QuestionType,
		QuestionWithAnswers,
	} from '@/db/repositories';
	import type { EditableAnswer } from '@/lib/types';
	import ImageUpload from './ImageUpload.svelte';
	import RichMathEditor from './RichMathEditor.svelte';
	import TagSelect from './TagSelect.svelte';
	import ConfirmModal from '@/lib/ui/ConfirmModal.svelte';
	import SegmentedControl from '@/lib/ui/SegmentedControl.svelte';
	import { migrateToPlainFormat } from '@/utils/math';
	import { getTags, initTags } from '@/lib/stores/tags.svelte';
	import { MAX_CHOICE_ANSWERS, validateQuestionData } from '@/pages/questions/validation';
	import { snackError } from '@/lib/stores/snackbar.svelte';
	import { onMount } from 'svelte';
	import { v4 as randomUUID } from 'uuid';
	import { i18n } from '@/lib/i18n.svelte';

	interface Props {
		question?: QuestionWithAnswers | null;
		onsave?: (data: QuestionEditData) => Promise<void>;
		oncancel?: () => void;
	}

	let { question = null, onsave, oncancel }: Props = $props();

	function defaultAnswers(q: QuestionWithAnswers | null | undefined): EditableAnswer[] {
		return (
			q?.answers.map((a) => ({
				key: a.id,
				content: migrateToPlainFormat(a.content),
				isCorrect: a.isCorrect,
			})) ?? []
		);
	}

	let content = $state('');
	let type = $state<QuestionType>('choice');
	let answerList = $state<EditableAnswer[]>([]);
	let image = $state<string | null>(null);
	let imageHeight = $state<number | null>(null);
	let imagePlacement = $state<ImagePlacement | null>(null);

	let originalContent = $state('');
	let originalType = $state<QuestionType>('choice');
	let originalAnswerList = $state<EditableAnswer[]>([]);
	let originalImage = $state<string | null>(null);
	let originalImageHeight = $state<number | null>(null);
	let originalImagePlacement = $state<ImagePlacement | null>(null);

	let contentEditorRef = $state<ReturnType<typeof RichMathEditor> | undefined>();
	let answerEditorRefs = $state<Record<string, ReturnType<typeof RichMathEditor> | undefined>>({});

	let selectedTags = $state<string[]>([]);
	let originalSelectedTags = $state<string[]>([]);
	let allTags = $derived(getTags());

	onMount(() => {
		initTags();
	});

	$effect(() => {
		const c = migrateToPlainFormat(question?.content);
		const t = question?.type ?? 'choice';
		const a = defaultAnswers(question);
		const img = question?.image ?? null;
		const imgH = question?.imageHeight ?? null;
		const imgP = question?.imagePlacement ?? null;
		const tags = question?.tags ?? [];

		content = c;
		type = t;
		answerList = a;
		image = img;
		imageHeight = imgH;
		imagePlacement = imgP;
		selectedTags = [...tags];

		originalContent = c;
		originalType = t;
		originalAnswerList = a.map((a) => ({ ...a }));
		originalImage = img;
		originalImageHeight = imgH;
		originalImagePlacement = imgP;
		originalSelectedTags = [...tags];
	});

	function answersEqual(a: EditableAnswer[], b: EditableAnswer[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i].key !== b[i].key) return false;
			if (a[i].content !== b[i].content) return false;
			if (a[i].isCorrect !== b[i].isCorrect) return false;
		}
		return true;
	}

	function tagsEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		const sortedA = [...a].sort();
		const sortedB = [...b].sort();
		for (let i = 0; i < sortedA.length; i++) {
			if (sortedA[i] !== sortedB[i]) return false;
		}
		return true;
	}

	let isDirty = $derived(
		content !== originalContent ||
			type !== originalType ||
			!answersEqual(answerList, originalAnswerList) ||
			image !== originalImage ||
			imageHeight !== originalImageHeight ||
			imagePlacement !== originalImagePlacement ||
			!tagsEqual(selectedTags, originalSelectedTags)
	);

	let canAddAnswer = $derived(type !== 'choice' || answerList.length < MAX_CHOICE_ANSWERS);

	let pendingTypeChange = $state<QuestionType | null>(null);
	let showCancelConfirm = $state(false);

	function requestTypeChange(newType: QuestionType) {
		if (newType === type) return;

		const hasMeaningfulData = answerList.some((a) => a.content.trim() !== '');

		if (hasMeaningfulData) {
			pendingTypeChange = newType;
		} else {
			applyTypeDefaults(newType);
		}
	}

	function confirmTypeChange() {
		if (pendingTypeChange) {
			applyTypeDefaults(pendingTypeChange);
			pendingTypeChange = null;
		}
	}

	function cancelTypeChange() {
		pendingTypeChange = null;
	}

	function applyTypeDefaults(newType: QuestionType) {
		type = newType;
		answerList = [];
	}

	function requestCancel() {
		if (isDirty) {
			showCancelConfirm = true;
		} else {
			oncancel?.();
		}
	}

	function confirmCancel() {
		showCancelConfirm = false;
		oncancel?.();
	}

	function dismissCancel() {
		showCancelConfirm = false;
	}

	function addAnswer() {
		if (!canAddAnswer) return;
		answerList = [...answerList, { key: randomUUID(), content: '', isCorrect: false }];
	}

	function removeAnswer(key: string) {
		answerList = answerList.filter((a) => a.key !== key);
		delete answerEditorRefs[key];
	}

	function setCorrect(key: string) {
		answerList = answerList.map((a) => ({ ...a, isCorrect: a.key === key }));
	}

	function setStatementTruth(key: string, isTrue: boolean) {
		answerList = answerList.map((answer) =>
			answer.key === key ? { ...answer, isCorrect: isTrue } : answer
		);
	}

	function onImageChange(data: {
		image: string | null;
		imageHeight: number | null;
		imagePlacement: ImagePlacement | null;
	}) {
		image = data.image;
		imageHeight = data.imageHeight;
		imagePlacement = data.imagePlacement;
	}

	let saving = $state(false);

	async function handleSave() {
		const currentContent = contentEditorRef?.getValue() ?? content;

		const answers: { content: string; isCorrect: boolean }[] = [];
		for (const answer of answerList) {
			const ref = answerEditorRefs[answer.key];
			const answerContent = ref?.getValue() ?? answer.content;
			if (answerContent.trim()) {
				answers.push({ content: answerContent.trim(), isCorrect: answer.isCorrect });
			}
		}

		const validation = validateQuestionData(currentContent, type, answers);
		if (!validation.valid) {
			snackError(validation.error!);
			return;
		}

		saving = true;
		try {
			await onsave?.({
				content: currentContent.trim(),
				type,
				answers,
				image,
				imageHeight,
				imagePlacement: imagePlacement ?? undefined,
				tags: selectedTags,
			});
		} finally {
			saving = false;
		}
	}
</script>

<article class="question-edit">
	<div class="edit-field">
		<label class="field-label" for="q-content">{i18n.t('questions.editor.content')}</label>
		<RichMathEditor
			bind:this={contentEditorRef}
			bind:value={content}
			id="q-content"
			aria-label={i18n.t('questions.editor.content')}
		/>
	</div>

	<div class="edit-field">
		<span class="field-label">{i18n.t('questions.editor.image')}</span>
		<ImageUpload
			bind:image
			bind:imageHeight
			bind:imagePlacement
			answersCount={answerList.length}
			onchange={onImageChange}
		/>
	</div>

	<div class="edit-field">
		<span class="field-label" id="mode-label">{i18n.t('questions.editor.type')}</span>
		<SegmentedControl
			aria-labelledby="mode-label"
			size="sm"
			value={type}
			options={[
				{ value: 'choice', label: i18n.t('questionType.choice') },
				{ value: 'true_false', label: i18n.t('questionType.trueFalse') },
			]}
			onchange={requestTypeChange}
		/>
	</div>

	<Divider />

	<div class="answers-section">
		<Text as="span" variant="body">
			{i18n.t(type === 'true_false' ? 'questions.editor.statements' : 'questions.editor.answers')}
		</Text>

		<ul class="answers-edit-list">
			{#each answerList as answer (answer.key)}
				<li class="answer-edit-row">
					{#if type === 'true_false'}
						<SegmentedControl
							aria-label={i18n.t('questions.editor.statementTruth')}
							size="sm"
							value={answer.isCorrect ? 'true' : 'false'}
							options={[
								{ value: 'true', label: i18n.t('questions.editor.trueShort') },
								{ value: 'false', label: i18n.t('questions.editor.falseShort') },
							]}
							onchange={(value) => setStatementTruth(answer.key, value === 'true')}
						/>
					{:else}
						<label class="correct-check">
							<input
								type="radio"
								name="correct-answer"
								checked={answer.isCorrect}
								onchange={() => setCorrect(answer.key)}
							/>
							<span class="check-label">{i18n.t('questions.editor.correct')}</span>
						</label>
					{/if}
					<div class="answer-input-wrapper">
						<RichMathEditor
							bind:this={answerEditorRefs[answer.key]}
							bind:value={answer.content}
							size="sm"
							aria-label={i18n.t(
								type === 'true_false'
									? 'questions.editor.statementContent'
									: 'questions.editor.answerContent'
							)}
						/>
					</div>
					<IconButton
						ariaLabel={i18n.t('questions.editor.removeAnswer')}
						variant="ghost"
						size="sm"
						onclick={() => removeAnswer(answer.key)}
					>
						✕
					</IconButton>
				</li>
			{/each}
		</ul>

		<Button variant="outline" size="sm" onclick={addAnswer} disabled={!canAddAnswer}>
			{i18n.t(
				type === 'true_false' ? 'questions.editor.addStatement' : 'questions.editor.addAnswer'
			)}
		</Button>
	</div>

	<div class="edit-field">
		<TagSelect
			label={i18n.t('questions.editor.tags')}
			selected={selectedTags}
			{allTags}
			onselect={(tags) => (selectedTags = tags)}
		/>
	</div>

	<div class="edit-actions">
		<Button variant="ghost" onclick={requestCancel}>{i18n.t('common.cancel')}</Button>
		<Button variant="primary" onclick={handleSave} disabled={saving}>
			{saving
				? i18n.t('common.saving')
				: question
					? i18n.t('questions.editor.saveChanges')
					: i18n.t('questions.editor.create')}
		</Button>
	</div>
</article>

<ConfirmModal
	open={pendingTypeChange !== null}
	oncancel={cancelTypeChange}
	title={i18n.t('questions.editor.changeTypeTitle')}
	confirmLabel={i18n.t('questions.editor.changeType')}
	onconfirm={confirmTypeChange}
>
	{i18n.t('questions.editor.changeTypePrompt')}
</ConfirmModal>

<ConfirmModal
	open={showCancelConfirm}
	oncancel={dismissCancel}
	title={i18n.t('common.unsavedChanges')}
	cancelLabel={i18n.t('questions.editor.returnToEdit')}
	confirmLabel={i18n.t('questions.editor.cancelEdit')}
	onconfirm={confirmCancel}
>
	{i18n.t('questions.editor.cancelPrompt')}
</ConfirmModal>

<style>
	.question-edit {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.edit-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.field-label {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		color: var(--text);
	}

	.answers-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.answers-edit-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.answer-edit-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.correct-check {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
		cursor: pointer;
		padding-top: var(--space-2);
	}

	.correct-check input[type='radio'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: var(--primary);
	}

	.check-label {
		font-family: var(--font-sans);
		font-size: var(--font-xs);
		color: var(--text-muted);
	}

	.answer-input-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
</style>
