<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import QuestionView from './QuestionView.svelte';
	import type { QuestionWithAnswers } from '@/db/repositories';
	import { i18n } from '@/lib/i18n.svelte';

	interface Props {
		question: QuestionWithAnswers;
		onedit?: () => void;
		ondelete?: () => void;
		disableEdit?: boolean;
	}

	let { question, onedit, ondelete, disableEdit = false }: Props = $props();

	let viewAnswers = $derived(
		question.answers.map((a) => ({ key: a.id, content: a.content, isCorrect: a.isCorrect }))
	);
</script>

<article class="question-display">
	<QuestionView
		type={question.type}
		content={question.content}
		answers={viewAnswers}
		tags={question.tags}
		image={question.image}
		imageHeight={question.imageHeight}
	>
		{#snippet actions()}
			<Button variant="outline" size="sm" onclick={onedit} disabled={disableEdit}
				>{i18n.t('common.edit')}</Button
			>
			<Button variant="danger" size="sm" onclick={ondelete}>{i18n.t('common.delete')}</Button>
		{/snippet}
	</QuestionView>

	{#if question.answers.length === 0}
		<Text variant="muted">{i18n.t('questions.noAnswers')}</Text>
	{/if}
</article>

<style>
	.question-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
