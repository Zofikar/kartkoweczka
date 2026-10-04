import type { DatabaseBridge, DatabaseBridgeResult, DatabaseMethod, DatabaseValue } from './bridge';

const READY_COMMAND = 'database_ready';
const EXECUTE_COMMAND = 'database_execute';

export async function createTauriDatabaseBridge(): Promise<DatabaseBridge> {
	const { invoke } = await import('@tauri-apps/api/core');

	return {
		ready: () => invoke<void>(READY_COMMAND),
		execute: (sql: string, params: DatabaseValue[], method: DatabaseMethod) =>
			invoke<DatabaseBridgeResult>(EXECUTE_COMMAND, { sql, params, method }),
	};
}
