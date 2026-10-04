import type { Database } from './database';
import { getDb } from '@/db/index';

/** Eagerly starts initialization so the first query doesn't pay the startup cost. */
export async function initializeDatabase(): Promise<void> {
	try {
		await getDb();
	} catch (error) {
		console.error('Failed to initialize database:', error);
	}
}

/** Drizzle transaction handle — exposes the same query API as `Database`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
