import type { Database } from '@/db/db';
import { questions, answers, tags, questionTags } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import type { QuestionType, ImagePlacement } from '@/db/schema/types';

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
	imageHeight?: number | null;
	imagePlacement?: ImagePlacement;
	tags?: string[];
}

export interface QuestionFilters {
	type?: QuestionType | null;
	tags?: string[];
	tagMode?: 'any' | 'all';
}

export async function loadQuestionById(
	db: Database,
	id: string
): Promise<QuestionWithAnswers | null> {
	const row = await db.query.questions.findFirst({
		with: {
			answers: true,
			questionTags: { with: { tag: true } },
		},
		where: (q, { eq }) => eq(q.id, id),
	});

	if (!row) return null;

	const { questionTags: qt, ...rest } = row;
	return {
		...rest,
		tags: qt.map((jt) => jt.tag.tagName),
	};
}

export async function loadAllQuestionsWithAnswers(db: Database): Promise<QuestionWithAnswers[]> {
	const rows = await db.query.questions.findMany({
		with: {
			answers: true,
			questionTags: { with: { tag: true } },
		},
		orderBy: (q, { desc }) => [desc(q.updatedAt)],
	});

	return rows.map(({ questionTags: qt, ...rest }) => ({
		...rest,
		tags: qt.map((jt) => jt.tag.tagName),
	}));
}

export async function loadAllTags(db: Database): Promise<string[]> {
	const rows = await db.select({ tagName: tags.tagName }).from(tags).orderBy(tags.tagName);
	return rows.map((r) => r.tagName);
}

export async function loadFilteredQuestionsWithAnswers(
	db: Database,
	filters: QuestionFilters
): Promise<QuestionWithAnswers[]> {
	const hasTypeFilter = !!filters.type;
	const hasTagFilter = filters.tags && filters.tags.length > 0;

	if (!hasTypeFilter && !hasTagFilter) {
		return loadAllQuestionsWithAnswers(db);
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

		const filteredQuery = baseQuery.where(sql.join(conditions, sql` AND `));

		const groupedQuery = filteredQuery.groupBy(sql`${questions.id}`);

		let finalQuery;
		if (mode === 'all') {
			finalQuery = groupedQuery.having(
				sql`COUNT(DISTINCT ${questionTags.tagName}) = ${tagNames.length}`
			);
		} else {
			finalQuery = groupedQuery;
		}

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

	return fullRows.map(({ questionTags: qt, ...rest }) => ({
		...rest,
		tags: qt.map((jt) => jt.tag.tagName),
	}));
}

export async function createQuestion(db: Database, data: QuestionEditData): Promise<string> {
	const [newQuestion] = await db
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
		await db.insert(answers).values(
			data.answers.map((a) => ({
				questionId: newQuestion.id,
				content: a.content,
				isCorrect: a.isCorrect,
			}))
		);
	}

	if (data.tags && data.tags.length > 0) {
		await syncQuestionTags(db, newQuestion.id, data.tags);
	}

	return newQuestion.id;
}

export async function updateQuestion(
	db: Database,
	id: string,
	data: QuestionEditData
): Promise<void> {
	await db
		.update(questions)
		.set({
			content: data.content,
			type: data.type,
			image: data.image ?? null,
			imageHeight: data.imageHeight ?? null,
			imagePlacement: data.imagePlacement ?? 'over',
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

	await syncQuestionTags(db, id, data.tags ?? []);
}

export async function deleteQuestion(db: Database, id: string): Promise<void> {
	await db.delete(questions).where(eq(questions.id, id));
	await cleanupOrphanedTags(db);
}

async function syncQuestionTags(
	db: Database,
	questionId: string,
	tagNames: string[]
): Promise<void> {
	await db.delete(questionTags).where(eq(questionTags.questionId, questionId));

	if (tagNames.length === 0) {
		await cleanupOrphanedTags(db);
		return;
	}

	for (const name of tagNames) {
		await db.insert(tags).values({ tagName: name }).onConflictDoNothing();
	}

	await db.insert(questionTags).values(
		tagNames.map((name) => ({
			questionId,
			tagName: name,
		}))
	);

	await cleanupOrphanedTags(db);
}

async function cleanupOrphanedTags(db: Database): Promise<void> {
	await db
		.delete(tags)
		.where(
			sql`${tags.tagName} NOT IN (SELECT DISTINCT ${questionTags.tagName} FROM ${questionTags})`
		);
}
