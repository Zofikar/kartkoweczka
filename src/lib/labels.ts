import type { QuestionType } from '@/db/repositories';
import { i18n } from './i18n.svelte';

export function questionTypeLabel(type: QuestionType): string {
	return type === 'choice' ? i18n.t('questionType.choice') : i18n.t('questionType.trueFalse');
}
