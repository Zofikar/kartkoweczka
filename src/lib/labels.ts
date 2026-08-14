import type { QuestionType } from '@/db/schema/types';

export function questionTypeLabel(type: QuestionType): string {
	return type === 'choice' ? 'Jednokrotny wybór' : 'Prawda / Fałsz';
}
