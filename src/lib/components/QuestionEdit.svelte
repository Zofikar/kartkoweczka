<script lang="ts">
	import 'mathlive';
	import Button from '@/lib/ui/Button.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import IconButton from '@/lib/ui/IconButton.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import type { QuestionEditData, QuestionWithAnswers } from '@/pages/questions/service';
	import type { QuestionType } from '@/db/schema/types';
	import ImageUpload from './ImageUpload.svelte';
	import { type RichContent, parseRichContent, serializeRichContent } from '@/utils/math';

	interface Props {
		/** Pass existing question to edit, or undefined for a new question */
		question?: QuestionWithAnswers | null;
		onsave?: (data: QuestionEditData) => void;
		oncancel?: () => void;
	}

	let { question = null, onsave, oncancel }: Props = $props();

	// ── editable fields ──────────────────────────────────────────────────────

	interface EditableAnswer {
		key: string;
		/** stored content (text or JSON segments) */
		content: string;
		isCorrect: boolean;
	}

	function defaultAnswers(q: QuestionWithAnswers | null | undefined): EditableAnswer[] {
		return (
			q?.answers.map((a) => ({
				key: a.id,
				content: a.content,
				isCorrect: a.isCorrect,
			})) ?? []
		);
	}

	let content = $state('');
	let type = $state<QuestionType>('choice');
	let answerList = $state<EditableAnswer[]>([]);
	let image = $state<string | null>(null);
	let imageWidth = $state<number | null>(null);
	let imageHeight = $state<number | null>(null);

	// ── contenteditable element refs ──────────────────────────────────────────

	let contentEditor: HTMLElement | undefined = $state();
	let answerEditorEls: Record<string, HTMLElement | undefined> = $state({});

	// Sync editable state from question prop
	$effect(() => {
		content = question?.content ?? '';
		type = question?.type ?? 'choice';
		answerList = defaultAnswers(question);
		image = question?.image ?? null;
		imageWidth = question?.imageWidth ?? null;
		imageHeight = question?.imageHeight ?? null;

		// Rebuild contenteditable DOM after next tick
		queueMicrotask(() => {
			if (contentEditor) {
				rebuildContentEditor(contentEditor, content);
			}
			for (const [key, el] of Object.entries(answerEditorEls)) {
				const answer = answerList.find((a) => a.key === key);
				if (el && answer) {
					rebuildContentEditor(el, answer.content);
				}
			}
		});
	});

	// ── contenteditable DOM helpers ───────────────────────────────────────────

	function rebuildContentEditor(container: HTMLElement, storedContent: string) {
		// Clear existing content
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}

		const segments = parseRichContent(storedContent);
		for (const seg of segments) {
			if (seg.type === 'text') {
				container.appendChild(document.createTextNode(seg.value));
			} else {
				const mf = document.createElement('math-field') as HTMLElement & { value: string };
				mf.setAttribute('default-mode', 'inline-math');
				mf.setAttribute('read-only', '');
				mf.style.display = 'inline-block';
				mf.style.verticalAlign = 'middle';
				mf.value = seg.value;
				container.appendChild(mf);
				// Add a space after math-field for cursor placement
				container.appendChild(document.createTextNode('\u00A0'));
			}
		}
	}

	function serializeEditor(container: HTMLElement): RichContent {
		const segments: RichContent = [];
		let buffer = '';

		const flush = () => {
			const cleaned = buffer.replace(/\u00A0/g, ' ');
			// Only skip truly empty text segments (no characters at all).
			// Preserve all whitespace so the user's spacing (newlines, spaces)
			// between text and formulas is retained.
			if (cleaned.length > 0) {
				segments.push({ type: 'text', value: cleaned });
			}
			buffer = '';
		};

		container.childNodes.forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				buffer += node.textContent ?? '';
			} else if (node.nodeName === 'MATH-FIELD') {
				flush();
				const mf = node as HTMLElement & { value: string };
				if (mf.value?.trim()) {
					segments.push({ type: 'math', value: mf.value });
				}
			} else {
				// For other elements (like <br>), treat as text
				if (node.nodeName === 'BR') {
					buffer += '\n';
				} else {
					buffer += node.textContent ?? '';
				}
			}
		});
		flush();
		return segments;
	}

	function insertFormula(editorEl: HTMLElement) {
		editorEl.focus();
		const sel = window.getSelection();
		let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
		if (!range || !editorEl.contains(range.commonAncestorContainer)) {
			range = document.createRange();
			range.selectNodeContents(editorEl);
			range.collapse(false);
		}

		const mf = document.createElement('math-field') as HTMLElement & { value: string };
		mf.setAttribute('default-mode', 'inline-math');
		mf.style.display = 'inline-block';
		mf.style.verticalAlign = 'middle';
		mf.value = '';

		range.deleteContents();
		range.insertNode(mf);

		const space = document.createTextNode('\u00A0');
		mf.after(space);

		// Move cursor after the space
		range.setStartAfter(space);
		range.collapse(true);
		sel?.removeAllRanges();
		sel?.addRange(range);

		mf.focus();
	}

	// ── answer management helpers ─────────────────────────────────────────────

	/**
	 * Serialize an answer editor back to stored content string,
	 * and update the answerList entry.
	 */
	function syncAnswerContent(key: string) {
		const el = answerEditorEls[key];
		if (!el) return;
		const segments = serializeEditor(el);
		const stored = serializeRichContent(segments);
		answerList = answerList.map((a) => (a.key === key ? { ...a, content: stored } : a));
	}

	// ── debounced sync on input ──────────────────────────────────────────────

	function onEditorInput(editorEl: HTMLElement, answerKey?: string) {
		if (answerKey) {
			// Update content directly from serialized state
			syncAnswerContent(answerKey);
		} else {
			// Content editor
			const segments = serializeEditor(editorEl);
			content = serializeRichContent(segments);
		}
	}

	// ── mode‑specific defaults ───────────────────────────────────────────────

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

	// ── answer management (CHOICE only) ──────────────────────────────────────

	function addAnswer() {
		answerList = [...answerList, { key: crypto.randomUUID(), content: '', isCorrect: false }];
	}

	function removeAnswer(key: string) {
		answerList = answerList.filter((a) => a.key !== key);
		delete answerEditorEls[key];
	}

	function toggleCorrect(key: string) {
		answerList = answerList.map((a) => (a.key === key ? { ...a, isCorrect: !a.isCorrect } : a));
	}

	// ── TRUE/FALSE toggle ────────────────────────────────────────────────────

	function setTrueFalseAnswer(correct: boolean) {
		answerList = answerList.map((a) => ({
			...a,
			isCorrect: correct ? a.content === 'Prawda' : a.content === 'Fałsz',
		}));
	}

	// ── image change handler ─────────────────────────────────────────────────

	function onImageChange(data: {
		image: string | null;
		imageWidth: number | null;
		imageHeight: number | null;
	}) {
		image = data.image;
		imageWidth = data.imageWidth;
		imageHeight = data.imageHeight;
	}

	// ── submit ───────────────────────────────────────────────────────────────

	let saving = $state(false);
	let error = $state('');

	async function handleSave() {
		error = '';

		// Serialize content editor
		if (contentEditor) {
			const segments = serializeEditor(contentEditor);
			content = serializeRichContent(segments);
		}

		if (!content.trim()) {
			error = 'Treść pytania jest wymagana.';
			return;
		}

		// Sync all answer editors
		for (const answer of answerList) {
			syncAnswerContent(answer.key);
		}

		const filledAnswers = answerList.filter((a) => a.content.trim() !== '');
		if (filledAnswers.length === 0) {
			error = 'Dodaj co najmniej jedną odpowiedź.';
			return;
		}

		if (type === 'choice' && !answerList.some((a) => a.isCorrect)) {
			error = 'Zaznacz co najmniej jedną poprawną odpowiedź.';
			return;
		}

		if (type === 'true_false' && !answerList.some((a) => a.isCorrect)) {
			error = 'Wskaż, która odpowiedź jest poprawna.';
			return;
		}

		saving = true;
		onsave?.({
			content: content.trim(),
			type,
			answers: filledAnswers.map((a) => ({
				content: a.content.trim(),
				isCorrect: a.isCorrect,
			})),
			image,
			imageWidth,
			imageHeight,
		});
	}
</script>

<article class="question-edit">
	<Heading level={4}>{question ? 'Edytuj pytanie' : 'Nowe pytanie'}</Heading>

	<!-- Content editor -->
	<div class="edit-field">
		<label class="field-label" for="q-content">Treść pytania</label>
		<div class="rich-editor-wrapper">
			<div
				id="q-content"
				class="rich-editor"
				contenteditable="true"
				bind:this={contentEditor}
				oninput={() => contentEditor && onEditorInput(contentEditor)}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
					}
				}}
				role="textbox"
				aria-multiline="true"
				aria-label="Treść pytania"
				tabindex="0"
			></div>
			<button
				type="button"
				class="insert-formula-btn"
				onclick={() => contentEditor && insertFormula(contentEditor)}
				title="Wstaw wzór matematyczny"
			>
				∑
			</button>
		</div>
	</div>

	<!-- Image upload -->
	<div class="edit-field">
		<span class="field-label">Obraz</span>
		<ImageUpload bind:image bind:imageWidth bind:imageHeight onchange={onImageChange} />
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
							<div class="rich-editor-wrapper rich-editor-wrapper--answer">
								<div
									class="rich-editor rich-editor--answer"
									contenteditable="true"
									bind:this={answerEditorEls[answer.key]}
									oninput={() => {
										const el = answerEditorEls[answer.key];
										if (el) onEditorInput(el, answer.key);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
										}
									}}
									role="textbox"
									aria-multiline="true"
									aria-label="Treść odpowiedzi"
									tabindex="0"
								></div>
								<button
									type="button"
									class="insert-formula-btn insert-formula-btn--sm"
									onclick={() => {
										const el = answerEditorEls[answer.key];
										if (el) insertFormula(el);
									}}
									title="Wstaw wzór matematyczny"
								>
									∑
								</button>
							</div>
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

	/* Rich editor wrapper (contenteditable + insert button) */
	.rich-editor-wrapper {
		display: flex;
		gap: var(--space-1);
		align-items: flex-start;
	}

	.rich-editor-wrapper--answer {
		width: 100%;
	}

	.rich-editor {
		flex: 1;
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		background-color: var(--background);
		border: 2px solid var(--background-muted);
		border-radius: var(--radius-md);
		outline: none;
		line-height: 1.6;
		overflow-wrap: break-word;
		white-space: pre-wrap;
	}

	.rich-editor:focus {
		border-color: var(--primary);
	}

	.rich-editor--answer {
		min-height: 38px;
		font-size: var(--font-base);
		padding: var(--space-1) var(--space-2);
	}

	/* Inline math-fields inside the editor */
	.rich-editor :global(math-field) {
		display: inline-block;
		vertical-align: middle;
		margin: 0 2px;
		border: 1px solid color-mix(in srgb, var(--primary) 40%, transparent);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
		background: color-mix(in srgb, var(--primary) 8%, var(--background));
		font-size: var(--font-base);
	}

	.insert-formula-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 44px;
		border: 2px solid var(--background-muted);
		border-radius: var(--radius-md);
		background: var(--background);
		color: var(--text-muted);
		font-size: var(--font-lg);
		font-family: var(--font-sans);
		cursor: pointer;
		transition: all 150ms ease;
		padding: 0;
		line-height: 1;
	}

	.insert-formula-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 5%, var(--background));
	}

	.insert-formula-btn--sm {
		width: 30px;
		height: 38px;
		font-size: var(--font-base);
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
