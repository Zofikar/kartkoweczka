import { getDb } from '@/db';
import { tags } from '../schema';

export async function listTags(): Promise<string[]> {
	const db = await getDb();
	const rows = await db.select({ tagName: tags.tagName }).from(tags).orderBy(tags.tagName);
	return rows.map((r) => r.tagName);
}
