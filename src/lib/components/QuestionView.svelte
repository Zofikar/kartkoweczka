<script lang="ts">
	import type { Snippet } from 'svelte';
	import Badge from '@/lib/ui/Badge.svelte';
	import type { QuestionType } from '@/db/schema/types';
	import { questionTypeLabel } from '@/lib/labels';
	import { renderDocumentToHtml } from '@/utils/math';

	interface ViewAnswer {
		key: string;
		content: string;
		isCorrect: boolean;
	}

	interface Props {
		type: QuestionType;
		content: string;
		answers: ViewAnswer[];
		tags?: string[];
		image?: string | null;
		imageHeight?: number | null;
		/** 0-based question index — when provided, an order badge with index + 1 is shown. */
		index?: number;
		/** Optional actions (e.g. edit/delete buttons) rendered at the right end of the meta row. */
		actions?: Snippet;
	}

	let {
		type,
		content,
		answers,
		tags = [],
		image = null,
		imageHeight = null,
		index,
		actions,
	}: Props = $props();

	let renderedContent = $derived(renderDocumentToHtml(content));
	let renderedAnswers = $derived(
		answers.map((a) => ({ ...a, renderedContent: renderDocumentToHtml(a.content) }))
	);

	let imageStyle = $derived.by(() => {
		const style: Record<string, string> = {
			maxWidth: '100%',
			borderRadius: 'var(--radius-md)',
			border: '1px solid var(--background-muted)',
			objectFit: 'contain',
		};
		if (imageHeight) {
			style.height = `${imageHeight}em`;
		}
		return Object.entries(style)
			.map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
			.join('; ');
	});
</script>

<div class={['question-view', index !== undefined && 'question-view--indexed']}>
	<div class="question-meta">
		{#if index !== undefined}
			<span class="order-badge">{index + 1}</span>
		{/if}
		<Badge variant="accent">{questionTypeLabel(type)}</Badge>
		{#each tags as tag (tag)}
			<Badge variant="secondary" size="sm">{tag}</Badge>
		{/each}
		{#if actions}
			<div class="question-actions">{@render actions()}</div>
		{/if}
	</div>

	<div class="question-text">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderedContent}
	</div>

	{#if image}
		<div class="question-image-wrapper">
			<img class="question-image" src={image} alt="Obraz do pytania" style={imageStyle} />
		</div>
	{/if}

	<ul class="answers-list">
		{#each renderedAnswers as answer (answer.key)}
			<li class="answer-item" class:answer-item--correct={answer.isCorrect}>
				<span class="answer-indicator">{answer.isCorrect ? '✓' : '✗'}</span>
				<span class="answer-content">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html answer.renderedContent}
				</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.question-view {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.question-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		align-items: center;
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

	.question-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.question-image-wrapper {
		display: flex;
		justify-content: flex-start;
		/* Align the image with the question text column, not the decorated-element line. */
		padding-left: var(--space-3);
	}

	.question-image {
		display: block;
		background-color: var(--background);
	}

	.answers-list {
		list-style: none;
		margin: 0;
		/* Inset so the indicator dots align with the question text and image. */
		padding: 0 0 0 var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.answer-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) 0;
	}

	.answer-item--correct {
		/* Breakout tint: the strip extends past the content line so the dot stays aligned. */
		background-color: color-mix(in srgb, var(--primary) 10%, var(--background));
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		margin: 0 calc(-1 * var(--space-2));
	}

	.answer-item--correct .answer-content {
		font-weight: var(--font-medium);
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
		/* Page-colored fill so the circle stays visible on muted card backgrounds. */
		background-color: var(--background);
		color: var(--text-muted);
	}

	.answer-content {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	/* When an order badge leads the meta row it defines the left line —
	   keep the content flush with its edge instead of the text column. */
	.question-view--indexed .question-text,
	.question-view--indexed .question-image-wrapper,
	.question-view--indexed .answers-list {
		padding-left: 0;
	}
</style>
