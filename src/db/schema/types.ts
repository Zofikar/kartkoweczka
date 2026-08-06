export type QuestionType = 'choice' | 'true_false';

export type ImagePlacement = 'over' | 'left' | 'right';

export interface SnapshotAnswer {
	content: string;
	is_correct: boolean;
}

export interface SnapshotQuestion {
	type: QuestionType;
	content: string;
	answers: SnapshotAnswer[];
	image?: string | null;
	imageHeight?: number | null;
	imagePlacement?: ImagePlacement | null;
}