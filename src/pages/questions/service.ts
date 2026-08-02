import type { initDb } from '@/db/db';
import { questions, answers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { QuestionType } from '@/db/schema/types';

export interface QuestionWithAnswers {
	id: string;
	content: string;
	type: QuestionType;
	image: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	createdAt: Date;
	updatedAt: Date;
	answers: AnswerWithId[];
}

interface AnswerWithId {
	id: string;
	questionId: string;
	content: string;
	isCorrect: boolean;
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
	return db.query.questions.findMany({
		with: { answers: true },
		orderBy: (q, { desc }) => [desc(q.updatedAt)],
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
