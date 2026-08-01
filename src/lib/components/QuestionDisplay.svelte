<script lang="ts">
	import Badge from '@/lib/ui/Badge.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import type { QuestionWithAnswers } from '@/pages/questions/service';
	import { renderRichContentToHtml } from '@/utils/math';

	interface Props {
		question: QuestionWithAnswers;
		onedit?: () => void;
		ondelete?: () => void;
	}

	let { question, onedit, ondelete }: Props = $props();

	let renderedContent = $derived(renderRichContentToHtml(question.content));
	let renderedAnswers = $derived(
		question.answers.map((a) => ({
			...a,
			renderedContent: renderRichContentToHtml(a.content),
		}))
	);

	// Image style
	let imageStyle = $derived.by(() => {
		const style: Record<string, string> = {
			maxWidth: '100%',
			borderRadius: 'var(--radius-md)',
			border: '1px solid var(--background-muted)',
		};
		if (question.imageWidth) style.width = `${question.imageWidth}px`;
		if (question.imageHeight) style.height = `${question.imageHeight}px`;
		return Object.entries(style)
			.map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
			.join('; ');
	});
</script>

<article class="question-display">
	<header class="question-header">
		<div class="question-meta">
			<Badge variant={question.type === 'choice' ? 'primary' : 'accent'}>
				{question.type === 'choice' ? 'Wielokrotny wybór' : 'Prawda / Fałsz'}
			</Badge>
		</div>
		<div class="question-actions">
			<Button variant="outline" size="sm" onclick={onedit}>Edytuj</Button>
			<Button variant="accent" size="sm" onclick={ondelete}>Usuń</Button>
		</div>
	</header>

	{#if question.image}
		<div class="question-image-wrapper">
			<img class="question-image" src={question.image} alt="Obraz do pytania" style={imageStyle} />
		</div>
	{/if}

	<div class="question-content">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderedContent}
	</div>

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

	.question-image-wrapper {
		display: flex;
		justify-content: flex-start;
	}

	.question-image {
		display: block;
		object-fit: contain;
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
</style>
