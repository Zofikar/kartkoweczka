import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { appDataDir, join } from '@tauri-apps/api/path';
import * as schema from './schema';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function initDb() {
	const dbName = 'app.db';
	let client: PGlite;

	if (isTauri) {
		const baseDir = await appDataDir();
		client = new PGlite(await join(baseDir, dbName));
	} else {
		client = new PGlite(`idb://${dbName}`);
	}
	console.log(`Created database client: ${client.dataDir}`);

	await client.waitReady;
	await runMigrations(client);

	return drizzle(client, { schema });
}

async function runMigrations(client: PGlite) {
	type MigrationRow = { name: string };

	const migrations = import.meta.glob<string>('./drizzle/*.sql', {
		eager: true,
		query: '?raw',
		import: 'default',
	});

	await client.exec(`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

	const res = await client.query<MigrationRow>('SELECT name FROM __drizzle_migrations;');
	const appliedSet = new Set(res.rows.map((r) => r.name));

	for (const path of Object.keys(migrations).sort()) {
		const name = path.split('/').pop()!;
		if (!appliedSet.has(name)) {
			await client.exec(migrations[path]);
			await client.query('INSERT INTO __drizzle_migrations (name) VALUES ($1);', [name]);
		}
	}
}
