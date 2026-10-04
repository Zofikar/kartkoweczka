import type { QuestionType } from '@/db/repositories';
import { i18n } from '@/lib/i18n.svelte';

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

export function validateQuestionData(
	content: string,
	type: QuestionType,
	answers: { content: string; isCorrect: boolean }[]
): ValidationResult {
	if (!content.trim()) {
		return { valid: false, error: i18n.t('questions.validation.contentRequired') };
	}

	const nonEmptyAnswers = answers.filter((a) => a.content.trim());

	if (type === 'choice' && nonEmptyAnswers.length < 3) {
		return {
			valid: false,
			error: i18n.t('questions.validation.minimumAnswers'),
		};
	}

	if (type === 'choice' && !nonEmptyAnswers.some((a) => a.isCorrect)) {
		return { valid: false, error: i18n.t('questions.validation.correctRequired') };
	}

	if (type === 'true_false' && nonEmptyAnswers.length === 0) {
		return { valid: false, error: i18n.t('questions.validation.statementRequired') };
	}

	return { valid: true };
}
