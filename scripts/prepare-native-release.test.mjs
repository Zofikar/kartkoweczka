import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { git } from './version.mjs';

test('release preparation stamps versions and preserves checked-in updater configuration', () => {
	const root = mkdtempSync(join(tmpdir(), 'native-release-'));
	try {
		mkdirSync(join(root, 'src-tauri'));
		const config = JSON.parse(
			readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')
		);
		writeFileSync(join(root, 'src-tauri/tauri.conf.json'), JSON.stringify(config));
		writeFileSync(join(root, 'package.json'), '{"version":"0.0.0"}');
		writeFileSync(join(root, 'src-tauri/Cargo.toml'), '[package]\nversion = "0.0.0"\n');
		writeFileSync(
			join(root, 'src-tauri/Cargo.lock'),
			'[[package]]\nname = "kartkoweczka"\nversion = "0.0.0"\n'
		);
		git(['init', '-b', 'main'], root);
		git(['config', 'user.email', 'test@example.com'], root);
		git(['config', 'user.name', 'Test'], root);
		git(['add', '.'], root);
		git(['commit', '-m', 'fixture'], root);
		git(['tag', 'v1.2.3'], root);
		const result = spawnSync(
			process.execPath,
			[fileURLToPath(new URL('./prepare-native-release.mjs', import.meta.url))],
			{
				cwd: root,
				encoding: 'utf8',
				env: {
					...process.env,
					BUILD_VERSION_JSON: '',
					RELEASE_TAG: 'v1.2.3',
					NATIVE_DESKTOP: 'true',
				},
			}
		);
		assert.equal(result.status, 0, result.stderr);
		const prepared = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
		assert.equal(prepared.version, '1.2.3');
		assert.equal(prepared.bundle.createUpdaterArtifacts, true);
		assert.deepEqual(prepared.plugins, config.plugins);
		assert.equal(prepared.bundle.android.versionCode, 1002003);
		assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '0.0.0');
		assert.match(readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8'), /version = "1.2.3"/);
		assert.match(readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8'), /version = "1.2.3"/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
