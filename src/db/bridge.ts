export type DatabaseMethod = 'run' | 'all' | 'values' | 'get';

export type DatabaseValue = unknown;

export interface DatabaseBridgeResult {
	rows: DatabaseValue[];
}

export interface DatabaseBridge {
	ready(): Promise<void>;
	execute(
		sql: string,
		params: DatabaseValue[],
		method: DatabaseMethod
	): Promise<DatabaseBridgeResult>;
}
