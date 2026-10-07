import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./configure-android-insets.mjs', import.meta.url));

test('configures the generated activity idempotently and rejects unexpected templates', () => {
	const root = mkdtempSync(join(tmpdir(), 'android-insets-'));
	try {
		const directory = join(root, 'src-tauri/gen/android/app/src/main/java/pl/test/app');
		mkdirSync(directory, { recursive: true });
		mkdirSync(join(root, 'src-tauri/android'), { recursive: true });
		const source = readFileSync(
			new URL('../src-tauri/android/MainActivity.kt', import.meta.url),
			'utf8'
		).replace('package pl.chwalczyk.kartkoweczka', 'package pl.test.app');
		writeFileSync(join(root, 'src-tauri/android/MainActivity.kt'), source);
		for (const name of ['AndroidUpdaterPlugin.kt', 'UpdatePolicy.java', 'update-paths.xml']) {
			writeFileSync(
				join(root, 'src-tauri/android', name),
				readFileSync(new URL(`../src-tauri/android/${name}`, import.meta.url), 'utf8')
			);
		}
		writeFileSync(join(root, 'src-tauri/tauri.conf.json'), '{"identifier":"pl.test.app"}');
		const activity = join(directory, 'MainActivity.kt');
		writeFileSync(activity, 'package pl.test.app\nclass MainActivity : TauriActivity() {}');
		const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
		assert.equal(run().status, 0);
		const result = readFileSync(activity, 'utf8');
		assert.equal(result, source);
		assert.equal(
			readFileSync(join(directory, 'AndroidUpdaterPlugin.kt'), 'utf8'),
			readFileSync(new URL('../src-tauri/android/AndroidUpdaterPlugin.kt', import.meta.url), 'utf8')
		);
		assert.match(
			readFileSync(
				join(root, 'src-tauri/gen/android/app/src/main/res/xml/update_paths.xml'),
				'utf8'
			),
			/path="updates\/"/
		);
		assert.match(result, /Type.systemBars\(\) or WindowInsetsCompat.Type.displayCutout\(\)/);
		assert.match(result, /maxOf\(safeArea.bottom, keyboard.bottom\)/);
		assert.match(result, /WindowInsetsCompat.CONSUMED/);
		assert.equal(run().status, 0);
		assert.equal(readFileSync(activity, 'utf8'), result);
		writeFileSync(activity, 'unexpected template');
		assert.notEqual(run().status, 0);
		assert.equal(readFileSync(activity, 'utf8'), 'unexpected template');
		writeFileSync(activity, 'package pl.test.app\nclass MainActivity : TauriActivity() {}');
		writeFileSync(join(root, 'src-tauri/android/MainActivity.kt'), 'package wrong.app\n');
		assert.notEqual(run().status, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
