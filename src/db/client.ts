import type { Database } from './db';


let promise: Promise<Database> | undefined;

/**
 * Returns the shared database handle, initializing it on first call.
 * Initialization failures reset the cache so the next call retries.
 *
 * Internal to the db layer — pages/helpers must use `db/repositories` instead.
 */
export function getDb(): Promise<Database> {
    promise ??= import('./db')
        .then(({ initDb }) => initDb())
        .catch((error) => {
            promise = undefined;
            throw error;
        });

    return promise;
}

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
