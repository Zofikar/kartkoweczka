import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitFixture } from './git-fixture.mjs';

test('native wrapper hands off Git metadata and restores manifests after failure', (t) => {
	const cwd = gitFixture(t);
	mkdirSync(join(cwd, 'src-tauri'));
	mkdirSync(join(cwd, 'node_modules/@tauri-apps/cli'), { recursive: true });
	const files = {
		'src-tauri/tauri.conf.json': '{"version":"0.0.0","bundle":{}}',
		'src-tauri/Cargo.toml': '[package]\nversion = "0.0.0"\n',
		'src-tauri/Cargo.lock': '[[package]]\nname = "kartkoweczka"\nversion = "0.0.0"\n',
	};
	for (const [file, content] of Object.entries(files)) writeFileSync(join(cwd, file), content);
	writeFileSync(
		join(cwd, 'node_modules/@tauri-apps/cli/tauri.js'),
		`
		const assert = require('node:assert/strict');
		const fs = require('node:fs');
		const metadata = JSON.parse(process.env.BUILD_VERSION_JSON);
		assert.equal(metadata.version, '1.2.3');
		assert.equal(JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json')).version, '1.2.3');
		process.exit(7);
	`
	);
	const result = spawnSync(
		process.execPath,
		[fileURLToPath(new URL('./run-native.mjs', import.meta.url)), 'build'],
		{
			cwd,
			encoding: 'utf8',
			env: { ...process.env, RELEASE_TAG: '', BUILD_VERSION_JSON: '' },
		}
	);
	assert.equal(result.status, 7, result.stderr);
	for (const [file, content] of Object.entries(files))
		assert.equal(readFileSync(join(cwd, file), 'utf8'), content);
});
