import { createDatabase, type Database } from './database';

let promise: Promise<Database> | undefined;

/**
 * Returns the shared database handle, initializing it on first call.
 * Initialization failures reset the cache so the next call retries.
 *
 * Internal to the db layer — pages/helpers must use `db/repositories` instead.
 */
export function getDb(): Promise<Database> {
	promise ??= createDatabaseBridge()
		.then(createDatabase)
		.catch((error) => {
			promise = undefined;
			throw error;
		});

	return promise;
}

async function createDatabaseBridge() {
	if (__DATABASE_BACKEND__ === 'tauri') {
		const { createTauriDatabaseBridge } = await import('./tauri.bridge');
		const bridge = await createTauriDatabaseBridge();
		await bridge.ready();
		return bridge;
	}

	const { createBrowserDatabaseBridge } = await import('./browser.bridge');
	return createBrowserDatabaseBridge();
}
