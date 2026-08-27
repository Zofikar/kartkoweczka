import { z } from 'zod';

export const QuestionTypeSchema = z.enum(['choice', 'true_false']);
export const ImagePlacementSchema = z.enum(['over', 'left', 'right']);
export const DateSchema = z.coerce.date();

export const TransferAnswerSchema = z.object({
	content: z.string(),
	isCorrect: z.boolean(),
});

export const TransferQuestionSchema = z.object({
	id: z.uuidv7(),
	content: z.string(),
	type: QuestionTypeSchema,
	image: z.string().nullable(),
	imageHeight: z.number().nullable(),
	imagePlacement: ImagePlacementSchema,
	createdAt: DateSchema,
	updatedAt: DateSchema,
	answers: z.array(TransferAnswerSchema),
	tags: z.array(z.string()),
});

export const TransferSnapshotQuestionSchema = z.object({
	type: QuestionTypeSchema,
	content: z.string(),
	answers: z.array(TransferAnswerSchema),
	image: z.string().nullable(),
	imageHeight: z.number().nullable(),
	imagePlacement: ImagePlacementSchema.nullable(),
});

export const TransferSnapshotTestSchema = z.object({
	id: z.uuidv7(),
	name: z.string(),
	content: z.array(TransferSnapshotQuestionSchema),
	createdAt: DateSchema,
});

export const TransferTestSchema = z.object({
	id: z.uuidv7(),
	name: z.string(),
	createdAt: DateSchema,
	updatedAt: DateSchema,

	questions: z.array(TransferQuestionSchema),
	revisions: z.array(TransferSnapshotTestSchema),
});

export type TransferTestSchemaType = z.infer<typeof TransferTestSchema>;
