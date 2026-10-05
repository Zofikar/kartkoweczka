import sqlite3InitModule, { type SqlValue } from '@sqlite.org/sqlite-wasm';

import {
	databaseClientLockName,
	type DatabaseBridgeResult,
	type DatabaseMethod,
	type DatabaseValue,
} from './bridge';

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
let ownerCheckTimer: ReturnType<typeof setTimeout> | undefined;
const OWNER_CHECK_INTERVAL_MS = 1_000;
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
	if (nextIndex < 0) {
		// Other clients are waiting on a transaction; make sure its owner is still alive.
		if (pendingExecutions.length > 0) scheduleOwnerCheck();
		return;
	}

	isExecuting = true;
	const [execution] = pendingExecutions.splice(nextIndex, 1);

	let settle: () => void;
	try {
		const result = await executeStatement(execution);
		settle = () => execution.resolve(result);
	} catch (error) {
		settle = () => execution.reject(error);
	}

	// Ownership must be settled before the client hears back and sends its next statement.
	await updateTransactionOwner(execution.clientId);
	isExecuting = false;
	settle();
	void drainExecutionQueue();
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

	return { rows: execution.method === 'get' ? (rows[0] ?? null) : rows };
}

/**
 * Derives ownership from the connection itself rather than parsing SQL, so a
 * failed BEGIN/COMMIT or an implicit rollback can never leave a stale owner.
 */
async function updateTransactionOwner(clientId: string): Promise<void> {
	try {
		const { sqlite3, database } = await getDatabaseHandle();
		const inTransaction = sqlite3.capi.sqlite3_get_autocommit(database.pointer!) === 0;
		transactionOwner = inTransaction ? clientId : undefined;
	} catch {
		// The database never opened, so no transaction can be open either.
		transactionOwner = undefined;
	}
}

function scheduleOwnerCheck(): void {
	ownerCheckTimer ??= setTimeout(() => {
		ownerCheckTimer = undefined;
		void releaseAbandonedTransaction();
	}, OWNER_CHECK_INTERVAL_MS);
}

/** Rolls back a transaction whose tab closed before it could COMMIT or ROLLBACK. */
async function releaseAbandonedTransaction(): Promise<void> {
	const owner = transactionOwner;
	if (!owner || isExecuting) {
		void drainExecutionQueue();
		return;
	}

	const { database } = await getDatabaseHandle();
	const { held = [] } = await navigator.locks.query();
	const ownerAlive = held.some(({ name }) => name === databaseClientLockName(owner));
	if (ownerAlive || transactionOwner !== owner || isExecuting) {
		void drainExecutionQueue();
		return;
	}

	console.warn('Rolling back a transaction abandoned by a closed tab.');
	try {
		database.exec('ROLLBACK');
	} catch (error) {
		console.error('Failed to roll back abandoned transaction:', error);
	}
	transactionOwner = undefined;
	void drainExecutionQueue();
}

async function getDatabase() {
	return (await getDatabaseHandle()).database;
}

function getDatabaseHandle() {
	databasePromise ??= createDatabase();
	return databasePromise;
}

async function createDatabase() {
	const sqlite3 = await sqlite3InitModule();
	const pool = await sqlite3.installOpfsSAHPoolVfs({ initialCapacity: 6 });
	const database = new pool.OpfsSAHPoolDb('/app.db');

	database.exec('PRAGMA foreign_keys = ON;');
	await runMigrations(database);

	return { sqlite3, database };
}

type SQLiteDatabase = Awaited<ReturnType<typeof createDatabase>>['database'];

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
