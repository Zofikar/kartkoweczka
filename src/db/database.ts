import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { DatabaseBridge, DatabaseMethod } from './bridge';
import * as relations from './schema/relations';
import * as tables from './schema';

export function createDatabase(bridge: DatabaseBridge) {
	let tail: Promise<unknown> = Promise.resolve();
	function enqueue<T>(run: () => Promise<T>): Promise<T> {
		const result = tail.then(run);
		tail = result.catch(() => undefined);
		return result;
	}
	// Drizzle types `rows` as an array, but at runtime maps a null `get` result to "no row".
	const execute = (sql: string, params: unknown[], method: DatabaseMethod) =>
		bridge.execute(sql, params, method) as Promise<{ rows: unknown[] }>;

	const options = {
		schema: {
			...tables,
			...relations,
		},
	};
	const db = drizzle((sql, params, method) => enqueue(() => execute(sql, params, method)), options);
	// A separate session lets transaction statements bypass the outer queue.
	// Standalone queries and entire transactions occupy the same queue instead.
	// Inside a transaction use tx (including tx.transaction), never the outer db.
	const transactionDb = drizzle(execute, options);
	db.transaction = ((run, config) =>
		enqueue(() => transactionDb.transaction(run, config))) as typeof db.transaction;

	return db;
}

export type Database = ReturnType<typeof createDatabase>;
