import * as Comlink from 'comlink';
import sqlite3InitModule, { type SqlValue } from '@sqlite.org/sqlite-wasm';

async function createDb() {
	const sqlite3 = await sqlite3InitModule();

	const pool = await sqlite3.installOpfsSAHPoolVfs({
		initialCapacity: 6,
	});

	const db = new pool.OpfsSAHPoolDb('/app.db');

	db.exec('PRAGMA foreign_keys = ON;');

	await runMigrations(db);

	return db;
}

type SQLiteDb = Awaited<ReturnType<typeof createDb>>;
async function runMigrations(db: SQLiteDb) {
	const migrations = import.meta.glob<string>('./drizzle/*.sql', {
		eager: true,
		query: '?raw',
		import: 'default',
	});

	db.exec(`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
                                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                            name TEXT NOT NULL UNIQUE,
                                                            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

	const applied: string[] = [];

	db.exec({
		sql: `
            SELECT name
            FROM __drizzle_migrations
        `,
		rowMode: '$name',
		callback(name) {
			applied.push(name as string);
		},
	});

	const appliedSet = new Set(applied);

	for (const path of Object.keys(migrations).sort()) {
		const name = path.split('/').pop()!;

		if (appliedSet.has(name)) {
			continue;
		}

		db.exec('BEGIN');

		try {
			db.exec(migrations[path]);

			db.exec({
				sql: `
                    INSERT INTO __drizzle_migrations (name)
                    VALUES (?)
                `,
				bind: [name],
			});

			db.exec('COMMIT');
		} catch (error) {
			db.exec('ROLLBACK');
			throw error;
		}
	}
}

let dbPromise: ReturnType<typeof createDb> | undefined;

function getDb() {
	dbPromise ??= createDb();
	return dbPromise;
}

const api = {
	async ready() {
		await getDb();
	},

	async values(sql: string, params: SqlValue[] = []): Promise<SqlValue[][]> {
		const db = await getDb();

		const rows: SqlValue[][] = [];

		db.exec({
			sql,
			bind: params,
			rowMode: 'array',
			callback(row) {
				rows.push(row);
			},
		});

		return rows;
	},

	async exec(sql: string, params: SqlValue[] = []): Promise<void> {
		const db = await getDb();

		db.exec({
			sql,
			bind: params,
		});
	},
};

export type DbWorkerApi = typeof api;

Comlink.expose(api);
