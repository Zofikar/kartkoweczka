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
