/**
 * Domain types exposed by the data layer.
 *
 * These describe the *logical* model used by pages/helpers — the db schema
 * imports from here, never the other way around, so consumers of the data
 * layer never need to know how data is physically stored.
 */

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

export interface AnswerWithId {
	id: string;
	questionId: string;
	content: string;
	isCorrect: boolean;
}

export interface QuestionWithAnswers {
	id: string;
	content: string;
	type: QuestionType;
	image: string | null;
	imageHeight: number | null;
	imagePlacement: ImagePlacement;
	createdAt: Date;
	updatedAt: Date;
	answers: AnswerWithId[];
	tags: string[];
}

export interface QuestionEditData {
	content: string;
	type: QuestionType;
	answers: { id?: string; content: string; isCorrect: boolean }[];
	image?: string | null;
	imageHeight?: number | null;
	imagePlacement?: ImagePlacement;
	tags?: string[];
}

export interface QuestionFilters {
	type?: QuestionType | null;
	tags?: string[];
	tagMode?: 'any' | 'all';
}

export interface TestSummary {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	questionCount: number;
}

export interface TestWithQuestions {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	questions: QuestionWithAnswers[];
}

export interface SaveTestData {
	name: string;
	questionIds: string[];
}

export interface CreateRevisionData {
	name: string;
	questions: SnapshotQuestion[];
}

export interface TestRevision {
	id: string;
	testId: string;
	name: string;
	content: SnapshotQuestion[];
	createdAt: Date;
}

export interface TestRevisionSummary {
	id: string;
	name: string;
	createdAt: Date;
}
