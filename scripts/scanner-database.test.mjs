import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Load the actual implementation without browser-only schema dependencies.
async function loadSource(path, replacements) {
	let source = readFileSync(new URL(path, import.meta.url), 'utf8');
	for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement);
	const js = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
	return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { createDatabase } = await loadSource('../src/db/database.ts', [
	[/import \* as relations[^\n]+/, 'const relations = {};'],
	[/import \* as tables[^\n]+/, 'const tables = {};'],
	[
		/'drizzle-orm\/sqlite-proxy'/,
		JSON.stringify(
			pathToFileURL(`${process.cwd()}/node_modules/drizzle-orm/sqlite-proxy/index.js`).href
		),
	],
]);

test('production scans skip normalized image extraction while diagnostics retain it', async () => {
	let extracted = 0;
	const vector = () => ({ delete() {}, [Symbol.iterator]: function* () {} });
	const module = {
		ImageQuality: { TooDark: { value: 1 }, TooBright: { value: 2 } },
		checkImageQuality: () => ({ value: 0 }),
		SheetGrader: class {
			detectAruco() {
				return [
					{ tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } },
					{ tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } },
					{ tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } },
				]
					.map((d) => ({ ...d, id: 26 }))
					.reduce(
						(result, d) => {
							result.push(d);
							return result;
						},
						Object.assign([], { delete() {} })
					);
			}
			normalize() {
				return true;
			}
			alignmentDiagnostics() {
				return vector();
			}
			overlayDiagnostics() {
				return Object.assign(Array.from(new TextEncoder().encode('[]')), { delete() {} });
			}
			normalizedImage() {
				extracted++;
				return { data: vector() };
			}
			detectRevisionId() {
				return { revisionId: vector() };
			}
			gradeSheet() {
				return vector();
			}
			delete() {}
		},
	};
	globalThis.__scannerTest = module;
	try {
		const scanner = await loadSource('../src/utils/omrScanner.ts', [
			[
				/import \{[\s\S]*?\} from '@\/utils\/openOmr';/,
				`const getOpenOmr = async () => globalThis.__scannerTest;
const imageDataToOpenOmrImage = () => ({data: {delete() {}}});
const openOmrImageToImageData = () => ({normalized: true});
const bytesToUuid = () => 'revision';`,
			],
			[/import \{ i18n \}[^\n]+/, 'const i18n = {t: (key) => key};'],
			[/import \{ buildQuestionResponseRows[^\n]+/, 'const buildQuestionResponseRows = () => [];'],
		]);
		const production = await scanner.scanGradingSheetImageData({});
		assert.equal(extracted, 0);
		assert.equal(production.normalizedImage, undefined);
		const diagnostics = await scanner.diagnoseGradingSheetImageData({});
		assert.equal(extracted, 1);
		assert.deepEqual(diagnostics.normalizedImage, { normalized: true });
	} finally {
		delete globalThis.__scannerTest;
	}
});

test('standalone reads and writes wait for rollback; nested savepoints and later transactions work', async () => {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('CREATE TABLE t(x TEXT)');
	const db = createDatabase({
		async execute(sql, params, method) {
			const statement = sqlite.prepare(sql);
			if (method === 'run') {
				statement.run(...params);
				return { rows: [] };
			}
			statement.setReturnArrays(true);
			return {
				rows: method === 'get' ? (statement.get(...params) ?? null) : statement.all(...params),
			};
		},
	});
	try {
		let release;
		let inserted;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		const ready = new Promise((resolve) => {
			inserted = resolve;
		});
		const transaction = db.transaction(async (tx) => {
			await tx.run("INSERT INTO t VALUES ('rolled back')");
			inserted();
			await gate;
			throw new Error('rollback');
		});
		const rejected = assert.rejects(transaction, /rollback/);
		await ready;
		let readFinished = false;
		const read = db.all('SELECT * FROM t').then((rows) => {
			readFinished = true;
			return rows;
		});
		const write = db.run("INSERT INTO t VALUES ('standalone')");
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(readFinished, false);
		release();
		await rejected;
		assert.deepEqual(await read, []);
		await write;
		await db.transaction(async (tx) => {
			await assert.rejects(
				tx.transaction(async (nested) => {
					await nested.run("INSERT INTO t VALUES ('nested rollback')");
					throw new Error('nested');
				}),
				/nested/
			);
			await tx.run("INSERT INTO t VALUES ('committed')");
		});
		assert.deepEqual(await db.all('SELECT * FROM t'), [['standalone'], ['committed']]);
	} finally {
		sqlite.close();
	}
});
