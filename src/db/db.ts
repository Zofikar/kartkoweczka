import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

export async function initDb() {
	const dbName = 'app.db';
	const client = new PGlite(`idb://${dbName}`);

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
