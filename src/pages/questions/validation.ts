import type { QuestionType } from '@/db/schema/types';

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
		return { valid: false, error: 'Treść pytania jest wymagana.' };
	}

	const nonEmptyAnswers = answers.filter((a) => a.content.trim());

	if (type === 'choice' && nonEmptyAnswers.length < 3) {
		return {
			valid: false,
			error: 'Dodaj co najmniej 3 odpowiedzi dla pytania jednokrotnego wyboru.',
		};
	}

	if (type === 'choice' && !nonEmptyAnswers.some((a) => a.isCorrect)) {
		return { valid: false, error: 'Wskaż poprawną odpowiedź.' };
	}

	if (type === 'true_false' && !nonEmptyAnswers.some((a) => a.isCorrect)) {
		return { valid: false, error: 'Wskaż, która odpowiedź jest poprawna.' };
	}

	return { valid: true };
}
