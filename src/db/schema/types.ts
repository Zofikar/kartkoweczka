export type QuestionType = 'choice' | 'true_false';

export interface SnapshotAnswer {
	content: string;
	is_correct: boolean;
}

export interface SnapshotQuestion {
	type: QuestionType;
	content: string;
	answers: SnapshotAnswer[];
	image?: string | null;
	imageWidth?: number | null;
	imageHeight?: number | null;
}
