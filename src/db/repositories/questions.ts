import { eq, inArray, sql } from 'drizzle-orm';
import type { Transaction } from '../client';
import { getDb } from '@/db';
import { answers, questions, questionTags, tags } from '../schema';
import { emitDataChanged } from './events';
import type { QuestionEditData, QuestionFilters, QuestionWithAnswers } from './types';

type QuestionWithRelations = typeof questions.$inferSelect & {
	answers: (typeof answers.$inferSelect)[];
	questionTags: (typeof questionTags.$inferSelect & { tag: typeof tags.$inferSelect })[];
};

function toQuestionWithAnswers(row: QuestionWithRelations): QuestionWithAnswers {
	const { questionTags: qt, ...rest } = row;
	return {
		...rest,
		tags: qt.map((jt) => jt.tag.tagName),
	};
}

export async function getQuestion(id: string): Promise<QuestionWithAnswers | null> {
	const db = await getDb();
	const row = await db.query.questions.findFirst({
		with: {
			answers: true,
			questionTags: { with: { tag: true } },
		},
		where: (q, { eq }) => eq(q.id, id),
	});

	return row ? toQuestionWithAnswers(row) : null;
}

export async function listQuestions(filters: QuestionFilters = {}): Promise<QuestionWithAnswers[]> {
	const db = await getDb();
	const hasTypeFilter = !!filters.type;
	const hasTagFilter = !!filters.tags && filters.tags.length > 0;

	if (!hasTypeFilter && !hasTagFilter) {
		const rows = await db.query.questions.findMany({
			with: {
				answers: true,
				questionTags: { with: { tag: true } },
			},
			orderBy: (q, { desc }) => [desc(q.updatedAt)],
		});

		return rows.map(toQuestionWithAnswers);
	}

	let ids: string[];

	if (hasTagFilter) {
		const tagNames = filters.tags!;
		const mode = filters.tagMode ?? 'any';

		const baseQuery = db
			.select({ id: questions.id })
			.from(questions)
			.innerJoin(questionTags, eq(questions.id, questionTags.questionId));

		const conditions: ReturnType<typeof eq>[] = [inArray(questionTags.tagName, tagNames)];

		if (hasTypeFilter) {
			conditions.push(eq(questions.type, filters.type!));
		}

		const groupedQuery = baseQuery
			.where(sql.join(conditions, sql` AND `))
			.groupBy(sql`${questions.id}`);

		const finalQuery =
			mode === 'all'
				? groupedQuery.having(sql`COUNT(DISTINCT ${questionTags.tagName}) = ${tagNames.length}`)
				: groupedQuery;

		const tagRows = await finalQuery;
		ids = tagRows.map((r) => r.id);
	} else {
		const typeRows = await db
			.select({ id: questions.id })
			.from(questions)
			.where(eq(questions.type, filters.type!));
		ids = typeRows.map((r) => r.id);
	}

	if (ids.length === 0) {
		return [];
	}

	const fullRows = await db.query.questions.findMany({
		with: {
			answers: true,
			questionTags: { with: { tag: true } },
		},
		where: (q, { inArray: ia }) => ia(q.id, ids),
		orderBy: (q, { desc }) => [desc(q.updatedAt)],
	});

	return fullRows.map(toQuestionWithAnswers);
}

export async function createQuestion(data: QuestionEditData): Promise<string> {
	const db = await getDb();
	const id = await db.transaction(async (tx) => {
		const [newQuestion] = await tx
			.insert(questions)
			.values({
				content: data.content,
				type: data.type,
				image: data.image,
				imageHeight: data.imageHeight,
				imagePlacement: data.imagePlacement ?? 'over',
			})
			.returning({ id: questions.id });

		if (data.answers.length > 0) {
			await tx.insert(answers).values(
				data.answers.map((a) => ({
					questionId: newQuestion.id,
					content: a.content,
					isCorrect: a.isCorrect,
				}))
			);
		}

		if (data.tags && data.tags.length > 0) {
			await syncQuestionTags(tx, newQuestion.id, data.tags);
		}

		return newQuestion.id;
	});

	emitDataChanged('questions', 'tags');
	return id;
}

export async function updateQuestion(id: string, data: QuestionEditData): Promise<void> {
	const db = await getDb();
	await db.transaction(async (tx) => {
		const updated = await tx
			.update(questions)
			.set({
				content: data.content,
				type: data.type,
				image: data.image ?? null,
				imageHeight: data.imageHeight ?? null,
				imagePlacement: data.imagePlacement ?? 'over',
				updatedAt: new Date(),
			})
			.where(eq(questions.id, id))
			.returning({ id: questions.id });

		if (updated.length === 0) {
			throw new Error(`Question not found: ${id}`);
		}

		await tx.delete(answers).where(eq(answers.questionId, id));

		if (data.answers.length > 0) {
			await tx.insert(answers).values(
				data.answers.map((a) => ({
					questionId: id,
					content: a.content,
					isCorrect: a.isCorrect,
				}))
			);
		}

		await syncQuestionTags(tx, id, data.tags ?? []);
	});

	emitDataChanged('questions', 'tags');
}

export async function deleteQuestion(id: string): Promise<void> {
	const db = await getDb();
	await db.transaction(async (tx) => {
		await tx.delete(questions).where(eq(questions.id, id));
		await cleanupOrphanedTags(tx);
	});

	emitDataChanged('questions', 'tags');
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

	await cleanupOrphanedTags(tx);
}

async function cleanupOrphanedTags(tx: Transaction): Promise<void> {
	await tx
		.delete(tags)
		.where(
			sql`${tags.tagName} NOT IN (SELECT DISTINCT ${questionTags.tagName} FROM ${questionTags})`
		);
}
