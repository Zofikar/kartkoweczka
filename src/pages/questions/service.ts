import type { initDb } from '@/db/db';
import { questions, answers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { QuestionType } from '@/db/schema/types';

export type QuestionRow = typeof questions.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;

export interface QuestionWithAnswers extends QuestionRow {
	answers: AnswerRow[];
}

export interface QuestionEditData {
	content: string;
	type: QuestionType;
	answers: { id?: string; content: string; isCorrect: boolean }[];
	image?: string | null;
	imageWidth?: number | null;
	imageHeight?: number | null;
}

export async function loadAllQuestionsWithAnswers(
	db: Awaited<ReturnType<typeof initDb>>
): Promise<QuestionWithAnswers[]> {
	const allQuestions = await db.query.questions.findMany({
		with: { answers: true },
		orderBy: (q, { desc }) => [desc(q.updatedAt)],
	});
	return allQuestions;
}

export async function getQuestionWithAnswers(
	db: Awaited<ReturnType<typeof initDb>>,
	id: string
): Promise<QuestionWithAnswers | undefined> {
	return db.query.questions.findFirst({
		where: eq(questions.id, id),
		with: { answers: true },
	});
}

export async function createQuestion(
	db: Awaited<ReturnType<typeof initDb>>,
	data: QuestionEditData
): Promise<string> {
	const [newQuestion] = await db
		.insert(questions)
		.values({
			content: data.content,
			type: data.type,
			image: data.image,
			imageWidth: data.imageWidth,
			imageHeight: data.imageHeight,
		})
		.returning({ id: questions.id });

	if (data.answers.length > 0) {
		await db.insert(answers).values(
			data.answers.map((a) => ({
				questionId: newQuestion.id,
				content: a.content,
				isCorrect: a.isCorrect,
			}))
		);
	}

	return newQuestion.id;
}

export async function updateQuestion(
	db: Awaited<ReturnType<typeof initDb>>,
	id: string,
	data: QuestionEditData
): Promise<void> {
	await db
		.update(questions)
		.set({
			content: data.content,
			type: data.type,
			image: data.image ?? null,
			imageWidth: data.imageWidth ?? null,
			imageHeight: data.imageHeight ?? null,
			updatedAt: new Date(),
		})
		.where(eq(questions.id, id));

	await db.delete(answers).where(eq(answers.questionId, id));

	if (data.answers.length > 0) {
		await db.insert(answers).values(
			data.answers.map((a) => ({
				questionId: id,
				content: a.content,
				isCorrect: a.isCorrect,
			}))
		);
	}
}

export async function deleteQuestion(
	db: Awaited<ReturnType<typeof initDb>>,
	id: string
): Promise<void> {
	await db.delete(questions).where(eq(questions.id, id));
}
