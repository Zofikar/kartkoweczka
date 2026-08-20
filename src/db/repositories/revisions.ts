import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { testRevisions } from '../schema';
import { emitDataChanged } from './events';
import type { CreateRevisionData, TestRevision, TestRevisionSummary } from './types';

export async function listTestRevisions(testId: string): Promise<TestRevisionSummary[]> {
	const db = await getDb();
	const rows = await db.query.testRevisions.findMany({
		where: (r, { eq }) => eq(r.testId, testId),
		orderBy: (r, { desc }) => [desc(r.createdAt)],
	});

	return rows.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
}

export async function getTestRevision(revisionId: string): Promise<TestRevision | null> {
	const db = await getDb();
	const revision = await db.query.testRevisions.findFirst({
		where: (r, { eq }) => eq(r.id, revisionId),
	});

	if (!revision) return null;

	const { id, testId, name, content, createdAt } = revision;
	return { id, testId, name, content, createdAt };
}

export async function createTestRevision(
	testId: string,
	data: CreateRevisionData
): Promise<string> {
	const db = await getDb();
	const [revision] = await db
		.insert(testRevisions)
		.values({
			testId,
			name: data.name,
			content: data.questions,
		})
		.returning({ id: testRevisions.id });

	emitDataChanged('revisions');
	return revision.id;
}

export async function updateTestRevision(
	revisionId: string,
	data: CreateRevisionData
): Promise<void> {
	const db = await getDb();
	const updated = await db
		.update(testRevisions)
		.set({ name: data.name, content: data.questions })
		.where(eq(testRevisions.id, revisionId))
		.returning({ id: testRevisions.id });

	if (updated.length === 0) {
		throw new Error(`Test revision not found: ${revisionId}`);
	}

	emitDataChanged('revisions');
}

export async function deleteTestRevision(revisionId: string): Promise<void> {
	const db = await getDb();
	await db.delete(testRevisions).where(eq(testRevisions.id, revisionId));

	emitDataChanged('revisions');
}

/**
 * Generates the next revision name following the schema:
 * `Wersja {year}{uppercase_index}` (e.g. "Wersja 2026A").
 *
 * The next letter is derived from the highest existing letter for this test in
 * the current year, so deleting a revision does not cause a name to be reused.
 */
export async function generateNextRevisionName(testId: string): Promise<string> {
	const db = await getDb();
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
