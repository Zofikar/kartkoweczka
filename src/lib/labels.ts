import type { QuestionType } from '@/db/repositories';

export function questionTypeLabel(type: QuestionType): string {
	return type === 'choice' ? 'Jednokrotny wybór' : 'Prawda / Fałsz';
}
