export type DatabaseMethod = 'run' | 'all' | 'values' | 'get';

export type DatabaseValue = unknown;

export interface DatabaseBridgeResult {
	/** For `get`, a single row — or `null` when nothing matched, which Drizzle maps to `undefined`. */
	rows: DatabaseValue[] | null;
}

/** Each tab holds this lock for its lifetime, so the database host can tell when a client is gone. */
export function databaseClientLockName(clientId: string): string {
	return `kartkoweczka-database-client-${clientId}`;
}

export interface DatabaseBridge {
	ready(): Promise<void>;
	execute(
		sql: string,
		params: DatabaseValue[],
		method: DatabaseMethod
	): Promise<DatabaseBridgeResult>;
}
