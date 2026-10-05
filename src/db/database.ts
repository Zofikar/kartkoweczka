import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { DatabaseBridge, DatabaseMethod } from './bridge';
import * as relations from './schema/relations';
import * as tables from './schema';

export function createDatabase(bridge: DatabaseBridge) {
	// Drizzle types `rows` as an array, but at runtime maps a null `get` result to "no row".
	const execute = (sql: string, params: unknown[], method: DatabaseMethod) =>
		bridge.execute(sql, params, method) as Promise<{ rows: unknown[] }>;

	const db = drizzle(execute, {
		schema: {
			...tables,
			...relations,
		},
	});

	serializeTransactions(db);
	return db;
}

export type Database = ReturnType<typeof createDatabase>;

/**
 * All statements of a tab share one connection, so two overlapping
 * transactions would interleave: the second BEGIN fails and its ROLLBACK undoes
 * the first. Queue transactions so only one runs at a time. Writes must go
 * through `db.transaction` to be ordered with them, and must never start a
 * nested `db.transaction` (use `tx.transaction` instead) or they deadlock.
 */
function serializeTransactions(db: ReturnType<typeof drizzle<typeof tables & typeof relations>>) {
	const transaction = db.transaction.bind(db);
	let tail: Promise<unknown> = Promise.resolve();

	db.transaction = ((run, config) => {
		const result = tail.then(() => transaction(run, config));
		tail = result.catch(() => undefined);
		return result;
	}) as typeof db.transaction;
}
