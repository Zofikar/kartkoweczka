<script lang="ts">
	import Badge from '@/lib/ui/Badge.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import type { QuestionWithAnswers } from '@/pages/questions/service';
	import { renderDocumentToHtml } from '@/utils/math';

	interface Props {
		question: QuestionWithAnswers;
		onedit?: () => void;
		ondelete?: () => void;
		disableEdit?: boolean;
	}

	let { question, onedit, ondelete, disableEdit = false }: Props = $props();

	let renderedContent = $derived(renderDocumentToHtml(question.content));
	let renderedAnswers = $derived(
		question.answers.map((a) => ({
			...a,
			renderedContent: renderDocumentToHtml(a.content),
		}))
	);

	let imageStyle = $derived.by(() => {
		const style: Record<string, string> = {
			maxWidth: '100%',
			borderRadius: 'var(--radius-md)',
			border: '1px solid var(--background-muted)',
			objectFit: 'contain',
		};
		if (question.imageHeight) {
			style.height = `${question.imageHeight}em`;
		}
		return Object.entries(style)
			.map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
			.join('; ');
	});
</script>

<article class="question-display">
	<header class="question-header">
		<div class="question-meta">
			<Badge variant={question.type === 'choice' ? 'primary' : 'accent'}>
				{question.type === 'choice' ? 'Jednokrotny wybór' : 'Prawda / Fałsz'}
			</Badge>
		</div>
		<div class="question-actions">
			<Button variant="outline" size="sm" onclick={onedit} disabled={disableEdit}>Edytuj</Button>
			<Button variant="accent" size="sm" onclick={ondelete}>Usuń</Button>
		</div>
	</header>

	<div class="question-body">
		<div class="question-text-section">
			<div class="question-content">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html renderedContent}
			</div>

			{#if question.image}
				<div class="question-image-wrapper">
					<img
						class="question-image"
						src={question.image}
						alt="Obraz do pytania"
						style={imageStyle}
					/>
				</div>
			{/if}

			<Divider />

			<ul class="answers-list">
				{#each renderedAnswers as answer (answer.id)}
					<li class="answer-item" class:answer-item--correct={answer.isCorrect}>
						<span class="answer-indicator">
							{#if answer.isCorrect}
								✓
							{:else}
								✗
							{/if}
						</span>
						<span class="answer-content">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html answer.renderedContent}
						</span>
					</li>
				{/each}
			</ul>

			{#if question.answers.length === 0}
				<Text variant="muted">Brak odpowiedzi dla tego pytania.</Text>
			{/if}

			{#if question.tags && question.tags.length > 0}
				<div class="tags-row">
					{#each question.tags as tag (tag)}
						<Badge variant="secondary" size="sm">{tag}</Badge>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	.question-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.question-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.question-meta {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.question-actions {
		display: flex;
		gap: var(--space-2);
	}

	.question-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.question-text-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}

	.question-image-wrapper {
		display: flex;
		justify-content: flex-start;
	}

	.question-image {
		display: block;
	}

	.question-content {
		font-family: var(--font-sans);
		font-size: var(--font-lg);
		font-weight: var(--font-semibold);
		color: var(--text);
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.answers-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.answer-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		background-color: var(--background);
		border: 1px solid var(--background-muted);
	}

	.answer-item--correct {
		border-color: var(--primary);
		background-color: color-mix(in srgb, var(--primary) 10%, var(--background));
	}

	.answer-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
		font-size: var(--font-sm);
		font-weight: var(--font-bold);
		flex-shrink: 0;
	}

	.answer-item--correct .answer-indicator {
		background-color: var(--primary);
		color: var(--primary-text);
	}

	.answer-item:not(.answer-item--correct) .answer-indicator {
		background-color: var(--background-muted);
		color: var(--text-muted);
	}

	.answer-content {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-top: var(--space-1);
	}
</style>
