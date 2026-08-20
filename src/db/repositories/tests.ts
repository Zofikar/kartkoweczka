import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { testQuestions, tests } from '../schema';
import { emitDataChanged } from './events';
import type { SaveTestData, TestSummary, TestWithQuestions } from './types';

export async function listTests(): Promise<TestSummary[]> {
	const db = await getDb();
	const rows = await db.query.tests.findMany({
		with: { testQuestions: true },
		orderBy: (t, { desc }) => [desc(t.updatedAt)],
	});

	return rows.map(({ testQuestions: tq, ...rest }) => ({
		...rest,
		questionCount: tq.length,
	}));
}

export async function getTest(id: string): Promise<TestWithQuestions | null> {
	const db = await getDb();
	const test = await db.query.tests.findFirst({
		where: (t, { eq }) => eq(t.id, id),
	});

	if (!test) return null;

	const rows = await db.query.testQuestions.findMany({
		where: (tq, { eq }) => eq(tq.testId, id),
		with: {
			question: {
				with: {
					answers: true,
					questionTags: { with: { tag: true } },
				},
			},
		},
		orderBy: (tq, { asc }) => [asc(tq.questionOrder)],
	});

	const questions = rows.map(({ question }) => {
		const { questionTags: qt, ...rest } = question;
		return {
			...rest,
			tags: qt.map((jt) => jt.tag.tagName),
		};
	});

	return {
		id: test.id,
		name: test.name,
		createdAt: test.createdAt,
		updatedAt: test.updatedAt,
		questions,
	};
}

export async function createTest(data: SaveTestData): Promise<string> {
	const db = await getDb();
	const id = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(tests)
			.values({ name: data.name })
			.returning({ id: tests.id });

		if (data.questionIds.length > 0) {
			await tx.insert(testQuestions).values(
				data.questionIds.map((questionId, questionOrder) => ({
					testId: created.id,
					questionId,
					questionOrder,
				}))
			);
		}

		return created.id;
	});

	emitDataChanged('tests');
	return id;
}

export async function updateTest(id: string, data: SaveTestData): Promise<void> {
	const db = await getDb();
	await db.transaction(async (tx) => {
		const updated = await tx
			.update(tests)
			.set({ name: data.name, updatedAt: new Date() })
			.where(eq(tests.id, id))
			.returning({ id: tests.id });

		if (updated.length === 0) {
			throw new Error(`Test not found: ${id}`);
		}

		await tx.delete(testQuestions).where(eq(testQuestions.testId, id));

		if (data.questionIds.length > 0) {
			await tx.insert(testQuestions).values(
				data.questionIds.map((questionId, questionOrder) => ({
					testId: id,
					questionId,
					questionOrder,
				}))
			);
		}
	});

	emitDataChanged('tests');
}

export async function deleteTest(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(tests).where(eq(tests.id, id));

	emitDataChanged('tests');
}
