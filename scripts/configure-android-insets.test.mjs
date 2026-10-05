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
		writeFileSync(join(root, 'src-tauri/tauri.conf.json'), '{"identifier":"pl.test.app"}');
		const activity = join(directory, 'MainActivity.kt');
		writeFileSync(activity, 'package pl.test.app\nclass MainActivity : TauriActivity() {}');
		const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
		assert.equal(run().status, 0);
		const result = readFileSync(activity, 'utf8');
		assert.match(result, /Type.systemBars\(\) or WindowInsetsCompat.Type.displayCutout\(\)/);
		assert.match(result, /maxOf\(safeArea.bottom, keyboard.bottom\)/);
		assert.match(result, /WindowInsetsCompat.CONSUMED/);
		assert.equal(run().status, 0);
		assert.equal(readFileSync(activity, 'utf8'), result);
		writeFileSync(activity, 'unexpected template');
		assert.notEqual(run().status, 0);
		assert.equal(readFileSync(activity, 'utf8'), 'unexpected template');
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
