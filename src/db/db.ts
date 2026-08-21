import * as Comlink from 'comlink';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { SqlValue } from '@sqlite.org/sqlite-wasm';

import type { DbWorkerApi } from './db.worker';

import * as tables from './schema';
import * as relations from './schema/relations';

let dbPromise: ReturnType<typeof createDb> | undefined;
export type Database = Awaited<ReturnType<typeof createDb>>;

export function initDb() {
	dbPromise ??= createDb();
	return dbPromise;
}

async function createDb() {
	if (!(await ensurePersistentStorage())) {
		console.log('Storage is not persistent.');
	}

	const worker = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module' });

	const client = Comlink.wrap<DbWorkerApi>(worker);

	await client.ready();

	return drizzle(
		async (sql, params, method) => {
			const bind = params as SqlValue[];

			switch (method) {
				case 'run':
					await client.exec(sql, bind);
					return { rows: [] };

				case 'all':
				case 'values':
					return {
						rows: await client.values(sql, bind),
					};

				case 'get': {
					const rows = await client.values(sql, bind);

					return {
						rows: rows[0] ?? [],
					};
				}
			}
		},
		{
			schema: {
				...tables,
				...relations,
			},
		}
	);
}

async function ensurePersistentStorage() {
	if (!navigator.storage?.persist) {
		console.log('Storage API not supported.');
		return false;
	}

	if (await navigator.storage.persisted()) {
		console.log('Storage is already successfully persisted.');
		return true;
	}

	const granted = await navigator.storage.persist();

	if (granted) {
		console.log('Storage persistence granted by the browser.');
	} else {
		console.log('Storage persistence was denied.');
	}

	return granted;
}
