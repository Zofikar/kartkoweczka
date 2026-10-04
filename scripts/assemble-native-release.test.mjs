import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('release includes both Linux formats and rejects missing Debian signatures', () => {
	const dir = mkdtempSync(join(tmpdir(), 'native-release-'));
	try {
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
		const run = () =>
			spawnSync(
				process.execPath,
				[fileURLToPath(new URL('./assemble-native-release.mjs', import.meta.url))],
				{
					cwd: dir,
					env: { ...process.env, RELEASE_TAG: 'v1.2.3', GITHUB_REPOSITORY: 'Zofikar/kartkoweczka' },
					encoding: 'utf8',
				}
			);
		const result = run();
		assert.equal(result.status, 0, result.stderr);
		const manifest = JSON.parse(readFileSync(join(dir, 'release/version_mainfest.json'), 'utf8'));
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
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
