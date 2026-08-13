import type { Database } from '@/db/db';
import { tests, testQuestions, testRevisions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { QuestionWithAnswers } from '../questions/service';
import type { SnapshotQuestion } from '@/db/schema/types';

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

export async function createTest(db: Database, data: SaveTestData): Promise<string> {
	const [created] = await db.insert(tests).values({ name: data.name }).returning({ id: tests.id });

	if (data.questionIds.length > 0) {
		await db.insert(testQuestions).values(
			data.questionIds.map((questionId, questionOrder) => ({
				testId: created.id,
				questionId,
				questionOrder,
			}))
		);
	}

	return created.id;
}

export async function updateTest(db: Database, id: string, data: SaveTestData): Promise<void> {
	await db.update(tests).set({ name: data.name, updatedAt: new Date() }).where(eq(tests.id, id));

	await db.delete(testQuestions).where(eq(testQuestions.testId, id));

	if (data.questionIds.length > 0) {
		await db.insert(testQuestions).values(
			data.questionIds.map((questionId, questionOrder) => ({
				testId: id,
				questionId,
				questionOrder,
			}))
		);
	}
}

export async function deleteTest(db: Database, id: string): Promise<void> {
	await db.delete(tests).where(eq(tests.id, id));
}

export async function loadAllTests(db: Database): Promise<TestSummary[]> {
	const rows = await db.query.tests.findMany({
		with: { testQuestions: true },
		orderBy: (t, { desc }) => [desc(t.updatedAt)],
	});

	return rows.map(({ testQuestions: tq, ...rest }) => ({
		...rest,
		questionCount: tq.length,
	}));
}

export async function loadTestById(db: Database, id: string): Promise<TestWithQuestions | null> {
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
		const { questionTags, ...rest } = question;
		return {
			...rest,
			tags: questionTags.map((jt) => jt.tag.tagName),
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

/**
 * Generates the next revision name following the schema:
 * `Wersja {year}{uppercase_index}` (e.g. "Wersja 2026A").
 *
 * The next letter is derived from the highest existing letter for this test in
 * the current year, so deleting a revision does not cause a name to be reused.
 */
export async function generateNextRevisionName(db: Database, testId: string): Promise<string> {
	const year = new Date().getFullYear();
	const start = new Date(year, 0, 1);
	const end = new Date(year + 1, 0, 1);

	const prefix = `Wersja ${year}`;

	const rows = await db.query.testRevisions.findMany({
		where: (r, { eq, and, gte, lt }) =>
			and(eq(r.testId, testId), gte(r.createdAt, start), lt(r.createdAt, end)),
	});

	let maxIndex = -1;
	for (const row of rows) {
		if (!row.name.startsWith(prefix)) continue;
		const index = lettersToIndex(row.name.slice(prefix.length));
		if (index !== null && index > maxIndex) {
			maxIndex = index;
		}
	}

	return `${prefix}${indexToLetters(maxIndex + 1)}`;
}

function indexToLetters(index: number): string {
	let result = '';
	let n = index;
	do {
		result = String.fromCharCode(65 + (n % 26)) + result;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return result;
}

function lettersToIndex(suffix: string): number | null {
	if (!/^[A-Z]+$/.test(suffix)) return null;

	let index = 0;
	for (const char of suffix) {
		index = index * 26 + (char.charCodeAt(0) - 64);
	}

	return index - 1;
}

export async function loadTestRevisions(
	db: Database,
	testId: string
): Promise<TestRevisionSummary[]> {
	const rows = await db.query.testRevisions.findMany({
		where: (r, { eq }) => eq(r.testId, testId),
		orderBy: (r, { desc }) => [desc(r.createdAt)],
	});

	return rows.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
}

export interface TestRevisionSummary {
	id: string;
	name: string;
	createdAt: Date;
}

export async function createTestRevision(
	db: Database,
	testId: string,
	data: CreateRevisionData
): Promise<string> {
	const [revision] = await db
		.insert(testRevisions)
		.values({
			testId,
			name: data.name,
			content: data.questions,
		})
		.returning({ id: testRevisions.id });

	return revision.id;
}

export async function loadTestRevisionById(
	db: Database,
	revisionId: string
): Promise<TestRevision | null> {
	const revision = await db.query.testRevisions.findFirst({
		where: (r, { eq }) => eq(r.id, revisionId),
	});

	if (!revision) return null;

	const { id, testId, name, content, createdAt } = revision;
	return { id, testId, name, content, createdAt };
}

export async function updateTestRevision(
	db: Database,
	revisionId: string,
	data: CreateRevisionData
): Promise<void> {
	await db
		.update(testRevisions)
		.set({ name: data.name, content: data.questions })
		.where(eq(testRevisions.id, revisionId));
}

export async function deleteTestRevision(db: Database, revisionId: string): Promise<void> {
	await db.delete(testRevisions).where(eq(testRevisions.id, revisionId));
}
