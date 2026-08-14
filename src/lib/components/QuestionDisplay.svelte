<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import QuestionView from './QuestionView.svelte';
	import type { QuestionWithAnswers } from '@/pages/questions/service';

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
			<Button variant="outline" size="sm" onclick={onedit} disabled={disableEdit}>Edytuj</Button>
			<Button variant="danger" size="sm" onclick={ondelete}>Usuń</Button>
		{/snippet}
	</QuestionView>

	{#if question.answers.length === 0}
		<Text variant="muted">Brak odpowiedzi dla tego pytania.</Text>
	{/if}
</article>

<style>
	.question-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
