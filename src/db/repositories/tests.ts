import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
	answers,
	questions,
	questionTags,
	tags,
	testQuestions,
	testRevisions,
	tests,
} from '../schema';
import { emitDataChanged } from './events';
import type { SaveTestData, TestSummary, TestWithQuestions } from './types';
import type { TransferTestSchemaType } from '@/utils/transferSchemas';
import type { Transaction } from '@/db/client';

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
	await db.transaction(async (tx) => {
		await tx.delete(tests).where(eq(tests.id, id));
	});

	emitDataChanged('tests');
}

export async function exportTest(id: string): Promise<TransferTestSchemaType | null> {
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

	const revisions = await db.query.testRevisions.findMany({
		where: (tr, { eq }) => eq(tr.testId, id),
		orderBy: (tr, { desc }) => [desc(tr.createdAt)],
	});

	return {
		id: test.id,
		name: test.name,
		createdAt: test.createdAt,
		updatedAt: test.updatedAt,
		questions,
		revisions: revisions.map((r) => ({
			id: r.id,
			name: r.name,
			createdAt: r.createdAt,
			content: r.content.map((q) => ({
				type: q.type,
				content: q.content,
				image: q.image || null,
				imageHeight: q.imageHeight || null,
				imagePlacement: q.imagePlacement || null,
				answers: q.answers.map((a) => ({
					content: a.content,
					isCorrect: a.is_correct,
				})),
			})),
		})),
	};
}

async function syncQuestionTags(
	tx: Transaction,
	questionId: string,
	tagNames: string[]
): Promise<void> {
	await tx.delete(questionTags).where(eq(questionTags.questionId, questionId));

	if (tagNames.length === 0) {
		await cleanupOrphanedTags(tx);
		return;
	}

	for (const name of tagNames) {
		await tx.insert(tags).values({ tagName: name }).onConflictDoNothing();
	}

	await tx.insert(questionTags).values(
		tagNames.map((name) => ({
			questionId,
			tagName: name,
		}))
	);
}

async function cleanupOrphanedTags(tx: Transaction): Promise<void> {
	await tx
		.delete(tags)
		.where(
			sql`${tags.tagName} NOT IN (SELECT DISTINCT ${questionTags.tagName} FROM ${questionTags})`
		);
}

export async function importTest(importedTest: TransferTestSchemaType): Promise<string> {
	const db = await getDb();

	await db.transaction(async (tx) => {
		await tx.delete(tests).where(eq(tests.id, importedTest.id));
		await tx.delete(testQuestions).where(eq(testQuestions.testId, importedTest.id));

		await tx.insert(tests).values({
			id: importedTest.id,
			name: importedTest.name,
			createdAt: importedTest.createdAt,
			updatedAt: importedTest.updatedAt,
		});

		for (const [index, question] of importedTest.questions.entries()) {
			const setData = {
				content: question.content,
				type: question.type,
				image: question.image,
				imageHeight: question.imageHeight,
				imagePlacement: question.imagePlacement ?? 'over',
			};
			await tx
				.insert(questions)
				.values({
					id: question.id,
					...setData,
				})
				.onConflictDoUpdate({
					target: questions.id,
					set: setData,
				});

			if (question.answers.length > 0) {
				await tx.delete(answers).where(eq(answers.questionId, question.id));
				await tx.insert(answers).values(
					question.answers.map((a) => ({
						questionId: question.id,
						content: a.content,
						isCorrect: a.isCorrect,
					}))
				);
			}

			await tx.insert(testQuestions).values({
				testId: importedTest.id,
				questionId: question.id,
				questionOrder: index,
			});

			await syncQuestionTags(tx, question.id, question.tags);
		}

		await cleanupOrphanedTags(tx);

		for (const revision of importedTest.revisions) {
			await tx.delete(testRevisions).where(eq(testRevisions.id, revision.id));

			await tx.insert(testRevisions).values({
				id: revision.id,
				testId: importedTest.id,
				name: revision.name,
				createdAt: revision.createdAt,
				content: revision.content.map((q) => ({
					type: q.type,
					content: q.content,
					image: q.image,
					imageHeight: q.imageHeight,
					imagePlacement: q.imagePlacement ?? 'over',
					answers: q.answers.map((a) => ({
						content: a.content,
						is_correct: a.isCorrect,
					})),
				})),
			});
		}
	});

	emitDataChanged('tests', 'questions', 'tags', 'revisions');
	return importedTest.id;
}
