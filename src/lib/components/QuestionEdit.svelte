<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import IconButton from '@/lib/ui/IconButton.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import type { QuestionEditData, QuestionWithAnswers } from '@/pages/questions/service';
	import type { QuestionType, ImagePlacement } from '@/db/schema/types';
	import ImageUpload from './ImageUpload.svelte';
	import RichMathEditor from './RichMathEditor.svelte';
	import { migrateToPlainFormat } from '@/utils/math';

	interface Props {
		question?: QuestionWithAnswers | null;
		onsave?: (data: QuestionEditData) => void;
		oncancel?: () => void;
	}

	let { question = null, onsave, oncancel }: Props = $props();

	interface EditableAnswer {
		key: string;
		content: string;
		isCorrect: boolean;
	}

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

	let contentEditorRef = $state<ReturnType<typeof RichMathEditor> | undefined>();
	let answerEditorRefs = $state<Record<string, ReturnType<typeof RichMathEditor> | undefined>>({});

	$effect(() => {
		content = migrateToPlainFormat(question?.content);
		type = question?.type ?? 'choice';
		answerList = defaultAnswers(question);
		image = question?.image ?? null;
		imageHeight = question?.imageHeight ?? null;
		imagePlacement = question?.imagePlacement ?? null;
	});

	function applyTypeDefaults(newType: QuestionType) {
		type = newType;
		if (newType === 'true_false') {
			answerList = [
				{ key: crypto.randomUUID(), content: 'Prawda', isCorrect: false },
				{ key: crypto.randomUUID(), content: 'Fałsz', isCorrect: false },
			];
		} else if (answerList.length === 0) {
			answerList = [];
		}
	}

	function addAnswer() {
		answerList = [...answerList, { key: crypto.randomUUID(), content: '', isCorrect: false }];
	}

	function removeAnswer(key: string) {
		answerList = answerList.filter((a) => a.key !== key);
		delete answerEditorRefs[key];
	}

	function toggleCorrect(key: string) {
		answerList = answerList.map((a) => (a.key === key ? { ...a, isCorrect: !a.isCorrect } : a));
	}

	function setTrueFalseAnswer(correct: boolean) {
		answerList = answerList.map((a) => ({
			...a,
			isCorrect: correct ? a.content === 'Prawda' : a.content === 'Fałsz',
		}));
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
	let error = $state('');

	async function handleSave() {
		error = '';

		const currentContent = contentEditorRef?.getValue() ?? content;

		if (!currentContent.trim()) {
			error = 'Treść pytania jest wymagana.';
			return;
		}

		let answers: { content: string; isCorrect: boolean }[] = [];
		for (const answer of answerList) {
			const ref = answerEditorRefs[answer.key];
			const answerContent = ref?.getValue() ?? answer.content;
			if (answerContent.trim()) {
				answers.push({ content: answerContent.trim(), isCorrect: answer.isCorrect });
			}
		}

		if (answers.length === 0) {
			error = 'Dodaj co najmniej jedną odpowiedź.';
			return;
		}

		if (type === 'choice' && !answers.some((a) => a.isCorrect)) {
			error = 'Zaznacz co najmniej jedną poprawną odpowiedź.';
			return;
		}

		if (type === 'true_false' && !answers.some((a) => a.isCorrect)) {
			error = 'Wskaż, która odpowiedź jest poprawna.';
			return;
		}

		saving = true;
		onsave?.({
			content: currentContent.trim(),
			type,
			answers,
			image,
			imageHeight,
			imagePlacement: imagePlacement ?? undefined,
		});
	}
</script>

<article class="question-edit">
	<Heading level={4}>{question ? 'Edytuj pytanie' : 'Nowe pytanie'}</Heading>

	<div class="edit-field">
		<label class="field-label" for="q-content">Treść pytania</label>
		<RichMathEditor
			bind:this={contentEditorRef}
			bind:value={content}
			id="q-content"
			aria-label="Treść pytania"
		/>
	</div>

	<div class="edit-field">
		<span class="field-label">Obraz</span>
		<ImageUpload bind:image bind:imageHeight bind:imagePlacement answersCount={answerList.length} onchange={onImageChange} />
	</div>

	<div class="edit-field">
		<span class="field-label" id="mode-label">Typ pytania</span>
		<div class="mode-switch" role="radiogroup" aria-labelledby="mode-label">
			<button
				class="mode-btn"
				class:mode-btn--active={type === 'choice'}
				role="radio"
				aria-checked={type === 'choice'}
				onclick={() => applyTypeDefaults('choice')}
			>
				Wielokrotny wybór
			</button>
			<button
				class="mode-btn"
				class:mode-btn--active={type === 'true_false'}
				role="radio"
				aria-checked={type === 'true_false'}
				onclick={() => applyTypeDefaults('true_false')}
			>
				Prawda / Fałsz
			</button>
		</div>
	</div>

	<Divider />

	<div class="answers-section">
		<Text as="span" variant="body">Odpowiedzi</Text>

		{#if type === 'true_false'}
			<div class="tf-toggle-group" role="radiogroup" aria-label="Poprawna odpowiedź">
				<label class="tf-option">
					<input
						type="radio"
						name="tf-answer"
						checked={answerList.some((a) => a.content === 'Prawda' && a.isCorrect)}
						onchange={() => setTrueFalseAnswer(true)}
					/>
					<span>Prawda</span>
				</label>
				<label class="tf-option">
					<input
						type="radio"
						name="tf-answer"
						checked={answerList.some((a) => a.content === 'Fałsz' && a.isCorrect)}
						onchange={() => setTrueFalseAnswer(false)}
					/>
					<span>Fałsz</span>
				</label>
			</div>
		{:else}
			<ul class="answers-edit-list">
				{#each answerList as answer (answer.key)}
					<li class="answer-edit-row">
						<label class="correct-check">
							<input
								type="checkbox"
								checked={answer.isCorrect}
								onchange={() => toggleCorrect(answer.key)}
							/>
							<span class="check-label">Poprawna</span>
						</label>
						<div class="answer-input-wrapper">
							<RichMathEditor
								bind:this={answerEditorRefs[answer.key]}
								bind:value={answer.content}
								size="sm"
								aria-label="Treść odpowiedzi"
							/>
						</div>
						<IconButton
							ariaLabel="Usuń odpowiedź"
							variant="ghost"
							size="sm"
							onclick={() => removeAnswer(answer.key)}
						>
							✕
						</IconButton>
					</li>
				{/each}
			</ul>

			<Button variant="outline" size="sm" onclick={addAnswer}>+ Dodaj odpowiedź</Button>
		{/if}
	</div>

	{#if error}
		<span class="edit-error">{error}</span>
	{/if}

	<div class="edit-actions">
		<Button variant="ghost" onclick={oncancel}>Anuluj</Button>
		<Button variant="primary" onclick={handleSave} disabled={saving}>
			{saving ? 'Zapisywanie...' : question ? 'Zapisz zmiany' : 'Utwórz pytanie'}
		</Button>
	</div>
</article>

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

	.mode-switch {
		display: flex;
		gap: 0;
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 2px solid var(--background-muted);
		width: fit-content;
	}

	.mode-btn {
		padding: var(--space-1) var(--space-3);
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		border: none;
		background: var(--background);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.mode-btn--active {
		background: var(--primary);
		color: var(--primary-text);
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

	.correct-check input[type='checkbox'] {
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

	.tf-toggle-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.tf-option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background-color: var(--background);
		border: 1px solid var(--background-muted);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		transition: border-color 150ms ease;
	}

	.tf-option:has(input:checked) {
		border-color: var(--primary);
		background-color: color-mix(in srgb, var(--primary) 10%, var(--background));
	}

	.tf-option input[type='radio'] {
		width: 16px;
		height: 16px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.edit-error {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--accent);
	}
</style>
