import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { git } from './version.mjs';

test('release includes both Linux formats and rejects missing Debian signatures', () => {
	const dir = mkdtempSync(join(tmpdir(), 'native-release-'));
	try {
		git(['init', '-b', 'main'], dir);
		git(['config', 'user.email', 'test@example.com'], dir);
		git(['config', 'user.name', 'Test'], dir);
		git(['commit', '--allow-empty', '-m', 'fixture'], dir);
		git(['tag', 'v1.2.3'], dir);
		for (const [platform, extensions] of [
			['Windows_x64', ['.exe']],
			['Linux_x64', ['.AppImage', '.deb']],
			['Linux_arm', ['.AppImage', '.deb']],
			['Android_arm', ['.apk']],
		]) {
			const path = join(dir, 'artifacts', platform);
			mkdirSync(path, { recursive: true });
			for (const extension of extensions) {
				writeFileSync(join(path, 'app' + extension), 'fixture');
				if (extension !== '.apk')
					writeFileSync(join(path, 'app' + extension + '.sig'), 'signature');
			}
		}
		const run = (platforms = '') =>
			spawnSync(
				process.execPath,
				[fileURLToPath(new URL('./assemble-native-release.mjs', import.meta.url))],
				{
					cwd: dir,
					env: {
						...process.env,
						BUILD_VERSION_JSON: '',
						RELEASE_TAG: 'v1.2.3',
						GITHUB_REPOSITORY: 'Zofikar/kartkoweczka',
						...(platforms
							? { RELEASE_PLATFORMS: platforms }
							: { RELEASE_PLATFORMS: 'Windows_x64,Linux_x64,Linux_arm,Android_arm' }),
					},
					encoding: 'utf8',
				}
			);
		const result = run();
		assert.equal(result.status, 0, result.stderr);
		const manifest = JSON.parse(readFileSync(join(dir, 'release/version_mainfest.json'), 'utf8'));
		assert.equal(manifest.version, '1.2.3');
		assert.equal(Object.keys(manifest.downloads).length, 4);
		for (const [platform, arch] of [
			['Linux_x64', 'x86_64'],
			['Linux_arm', 'aarch64'],
		]) {
			assert.equal(manifest.downloads[platform], manifest.packages[platform].appimage);
			assert.equal(manifest.platforms[`linux-${arch}-deb`].url, manifest.packages[platform].deb);
			assert.equal(manifest.platforms[`linux-${arch}-appimage`].url, manifest.downloads[platform]);
			assert.ok(manifest.packages[platform].deb.endsWith('.deb'));
		}
		const notes = readFileSync(join(dir, 'release-notes.md'), 'utf8');
		assert.deepEqual(
			JSON.parse(/<!-- native-manifest -->\s*```json\s*([\s\S]*?)```/.exec(notes)[1]),
			manifest
		);
		rmSync(join(dir, 'artifacts/Linux_arm/app.deb.sig'));
		assert.notEqual(run().status, 0);
		rmSync(join(dir, 'artifacts/Linux_x64'), { recursive: true });
		rmSync(join(dir, 'artifacts/Linux_arm'), { recursive: true });
		const reduced = run('Windows_x64,Android_arm');
		assert.equal(reduced.status, 0, reduced.stderr);
		const reducedManifest = JSON.parse(
			readFileSync(join(dir, 'release/version_mainfest.json'), 'utf8')
		);
		assert.deepEqual(Object.keys(reducedManifest.downloads), ['Windows_x64', 'Android_arm']);
		assert.deepEqual(Object.keys(reducedManifest.platforms), ['windows-x86_64']);
		assert.notEqual(run('Unknown').status, 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
