import sqlite3InitModule, { type SqlValue } from '@sqlite.org/sqlite-wasm';

import type { DatabaseBridgeResult, DatabaseMethod, DatabaseValue } from './bridge';

interface PendingExecution {
	clientId: string;
	sql: string;
	params: DatabaseValue[];
	method: DatabaseMethod;
	resolve: (result: DatabaseBridgeResult) => void;
	reject: (error: unknown) => void;
}

let databasePromise: ReturnType<typeof createDatabase> | undefined;
let transactionOwner: string | undefined;
let isExecuting = false;
const pendingExecutions: PendingExecution[] = [];

export interface DatabaseWorkerApi {
	ready(): Promise<void>;
	execute(
		sql: string,
		params: DatabaseValue[],
		method: DatabaseMethod
	): Promise<DatabaseBridgeResult>;
}

export interface DatabaseWorkerHostApi {
	ready(): Promise<void>;
	executeForClient(
		clientId: string,
		sql: string,
		params: DatabaseValue[],
		method: DatabaseMethod
	): Promise<DatabaseBridgeResult>;
}

export function createDatabaseWorkerApi(clientId: string): DatabaseWorkerApi {
	return {
		ready: async () => void (await getDatabase()),
		execute: (sql, params, method) => scheduleExecution(clientId, sql, params, method),
	};
}

export function createDatabaseWorkerHostApi(): DatabaseWorkerHostApi {
	return {
		ready: async () => void (await getDatabase()),
		executeForClient: scheduleExecution,
	};
}

function scheduleExecution(
	clientId: string,
	sql: string,
	params: DatabaseValue[],
	method: DatabaseMethod
): Promise<DatabaseBridgeResult> {
	return new Promise((resolve, reject) => {
		pendingExecutions.push({ clientId, sql, params, method, resolve, reject });
		void drainExecutionQueue();
	});
}

async function drainExecutionQueue(): Promise<void> {
	if (isExecuting) return;

	const nextIndex = findNextExecutionIndex();
	if (nextIndex < 0) return;

	isExecuting = true;
	const [execution] = pendingExecutions.splice(nextIndex, 1);

	try {
		const result = await executeStatement(execution);
		updateTransactionOwner(execution.clientId, execution.sql);
		execution.resolve(result);
	} catch (error) {
		execution.reject(error);
	} finally {
		isExecuting = false;
		void drainExecutionQueue();
	}
}

function findNextExecutionIndex(): number {
	if (!transactionOwner) return pendingExecutions.length > 0 ? 0 : -1;
	return pendingExecutions.findIndex(({ clientId }) => clientId === transactionOwner);
}

async function executeStatement(execution: PendingExecution): Promise<DatabaseBridgeResult> {
	const database = await getDatabase();
	const rows: DatabaseValue[][] = [];

	database.exec({
		sql: execution.sql,
		bind: execution.params as SqlValue[],
		rowMode: 'array',
		callback(row) {
			rows.push(row);
		},
	});

	return { rows: execution.method === 'get' ? (rows[0] ?? []) : rows };
}

function updateTransactionOwner(clientId: string, sql: string): void {
	const operation = sql.trimStart().split(/\s+/, 1)[0]?.toUpperCase();

	if (operation === 'BEGIN') {
		transactionOwner = clientId;
	} else if (operation === 'COMMIT' || operation === 'ROLLBACK') {
		transactionOwner = undefined;
	}
}

function getDatabase() {
	databasePromise ??= createDatabase();
	return databasePromise;
}

async function createDatabase() {
	const sqlite3 = await sqlite3InitModule();
	const pool = await sqlite3.installOpfsSAHPoolVfs({ initialCapacity: 6 });
	const database = new pool.OpfsSAHPoolDb('/app.db');

	database.exec('PRAGMA foreign_keys = ON;');
	await runMigrations(database);

	return database;
}

type SQLiteDatabase = Awaited<ReturnType<typeof createDatabase>>;

async function runMigrations(database: SQLiteDatabase): Promise<void> {
	const migrations = import.meta.glob<string>('./drizzle/*.sql', {
		eager: true,
		query: '?raw',
		import: 'default',
	});

	database.exec(`
		CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	const appliedMigrations = readAppliedMigrations(database);
	for (const path of Object.keys(migrations).sort()) {
		const name = path.split('/').pop()!;
		if (!appliedMigrations.has(name)) applyMigration(database, name, migrations[path]);
	}
}

function readAppliedMigrations(database: SQLiteDatabase): Set<string> {
	const applied = new Set<string>();
	database.exec({
		sql: 'SELECT name FROM __drizzle_migrations',
		rowMode: '$name',
		callback(name) {
			applied.add(name as string);
		},
	});
	return applied;
}

function applyMigration(database: SQLiteDatabase, name: string, migration: string): void {
	database.exec('BEGIN');
	try {
		database.exec(migration);
		database.exec({
			sql: 'INSERT INTO __drizzle_migrations (name) VALUES (?)',
			bind: [name],
		});
		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}
