import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('executes the production Android update policy on the local JVM (requires JDK 17+)', () => {
	const directory = mkdtempSync(join(tmpdir(), 'android-update-policy-'));
	try {
		const sources = ['UpdatePolicy.java', 'tests/UpdatePolicyTest.java'].map((name) =>
			fileURLToPath(new URL(`../src-tauri/android/${name}`, import.meta.url))
		);
		const compile = spawnSync('javac', ['--release', '8', '-d', directory, sources[0]], {
			encoding: 'utf8',
		});
		assert.equal(compile.status, 0, compile.error?.message ?? compile.stderr);
		const tests = spawnSync('javac', ['-cp', directory, '-d', directory, sources[1]], {
			encoding: 'utf8',
		});
		assert.equal(tests.status, 0, tests.error?.message ?? tests.stderr);
		const run = spawnSync('java', ['-cp', directory, 'UpdatePolicyTest'], { encoding: 'utf8' });
		assert.equal(run.status, 0, run.error?.message ?? run.stderr);
		assert.match(run.stdout, /Passed \d+ Android update policy checks/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
