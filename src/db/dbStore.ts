import { writable } from 'svelte/store';
import { initDb } from './db';

export const db = writable<Awaited<ReturnType<typeof initDb>> | null>(null);
export const dbLoaded = writable<boolean>(false);

export async function initializeDatabase() {
	try {
		const database = await initDb();
		db.set(database);
		dbLoaded.set(true);
	} catch (error) {
		console.error('Failed to initialize database:', error);
	}
}
