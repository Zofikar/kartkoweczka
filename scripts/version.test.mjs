import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitFixture } from './git-fixture.mjs';
import { androidVersionCode, git, resolveVersion } from './version.mjs';

test('Git description handles exact tags, distance, unrelated tags and dirty files', (t) => {
	const cwd = gitFixture(t);
	assert.equal(resolveVersion({ cwd, env: {} }).displayVersion, '1.2.3');
	writeFileSync(join(cwd, 'fixture'), 'next');
	git(['commit', '-am', 'next'], cwd);
	git(['tag', 'list'], cwd);
	git(['tag', 'v99-invalid'], cwd);
	assert.match(resolveVersion({ cwd, env: {} }).displayVersion, /^1\.2\.3-1-g[0-9a-f]{7}$/);
	writeFileSync(join(cwd, 'fixture'), 'dirty');
	assert.match(resolveVersion({ cwd, env: {} }).displayVersion, /-dirty$/);
});

test('official release rejects wrong commits, dirty checkout and missing Git', (t) => {
	const cwd = gitFixture(t);
	assert.equal(resolveVersion({ cwd, env: { RELEASE_TAG: 'v1.2.3' } }).version, '1.2.3');
	writeFileSync(join(cwd, 'fixture'), 'dirty');
	assert.throws(() => resolveVersion({ cwd, env: { RELEASE_TAG: 'v1.2.3' } }), /clean/);
	git(['commit', '-am', 'next'], cwd);
	assert.throws(() => resolveVersion({ cwd, env: { RELEASE_TAG: 'v1.2.3' } }), /HEAD/);
	assert.throws(
		() => resolveVersion({ cwd: join(cwd, 'missing'), env: { RELEASE_TAG: 'v1.2.3' } }),
		/Git/
	);
});

test('development fallback and metadata handoff are explicit', (t) => {
	const cwd = gitFixture(t);
	const metadata = resolveVersion({ cwd, env: {} });
	assert.deepEqual(
		resolveVersion({
			cwd: join(cwd, 'missing'),
			env: { BUILD_VERSION_JSON: JSON.stringify(metadata) },
		}),
		metadata
	);
	assert.equal(resolveVersion({ cwd: join(cwd, 'missing'), env: {} }).displayVersion, '0.0.1-dev');
	git(['tag', '-d', 'v1.2.3'], cwd);
	assert.match(resolveVersion({ cwd, env: {} }).displayVersion, /^0\.0\.1-dev-g/);
	assert.throws(() => resolveVersion({ cwd, env: { BUILD_VERSION_JSON: '{}' } }), /Invalid/);
});

test('Android codes increase for patch, minor and major and enforce bounds', () => {
	assert.equal(androidVersionCode('1.2.3'), 1002003);
	assert.throws(() => androidVersionCode('0.0.0'), /bounds/);
	assert.ok(androidVersionCode('1.2.4') < androidVersionCode('1.3.0'));
	assert.ok(androidVersionCode('1.999.999') < androidVersionCode('2.0.0'));
	assert.throws(() => androidVersionCode('1.1000.0'), /bounds/);
	assert.throws(() => androidVersionCode('999999999999.0.0'), /bounds/);
});

test('release snapshots survive stamping but reject a changed tag or forged version', (t) => {
	const cwd = gitFixture(t);
	const metadata = resolveVersion({ cwd, env: { RELEASE_TAG: 'v1.2.3' } });
	writeFileSync(join(cwd, 'fixture'), 'stamped');
	const env = { RELEASE_TAG: 'v1.2.3', BUILD_VERSION_JSON: JSON.stringify(metadata) };
	assert.deepEqual(resolveVersion({ cwd, env }), metadata);
	assert.throws(
		() =>
			resolveVersion({
				cwd,
				env: { ...env, BUILD_VERSION_JSON: JSON.stringify({ ...metadata, version: '9.0.0' }) },
			}),
		/match/
	);
	git(['commit', '-am', 'next'], cwd);
	assert.throws(() => resolveVersion({ cwd, env }), /HEAD/);
});
