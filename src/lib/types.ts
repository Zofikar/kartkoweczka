import type { ImagePlacement, QuestionType } from '@/db/schema/types';

/** Answer shape used by edit/ordering UIs — `key` is a stable local identity for each blocks. */
export interface EditableAnswer {
	key: string;
	content: string;
	isCorrect: boolean;
}

/** Question shape used by edit/ordering UIs — `key` is a stable local identity for each blocks. */
export interface EditableQuestion {
	key: string;
	type: QuestionType;
	content: string;
	image: string | null;
	imageHeight: number | null;
	imagePlacement: ImagePlacement | null;
	answers: EditableAnswer[];
}
