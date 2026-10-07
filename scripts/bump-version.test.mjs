import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bumpVersion, planBump } from './bump-version.mjs';
import { gitFixture } from './git-fixture.mjs';
import { git } from './version.mjs';

test('stable bumps reset lower components and reject invalid input', () => {
	assert.equal(bumpVersion('v0.1.5', 'patch'), 'v0.1.6');
	assert.equal(bumpVersion('v0.1.5', 'minor'), 'v0.2.0');
	assert.equal(bumpVersion('v0.1.5', 'major'), 'v1.0.0');
	assert.throws(() => bumpVersion('v01.2.3', 'patch'));
	assert.throws(() => bumpVersion('v1.2.3', 'other'));
});

test('bump planning uses highest stable tag and requires clean main', (t) => {
	const cwd = gitFixture(t);
	git(['tag', 'list'], cwd);
	assert.equal(planBump('patch', cwd).tag, 'v1.2.4');
	git(['tag', 'v1.2.4'], cwd);
	assert.equal(planBump('patch', cwd).tag, 'v1.2.5');
	writeFileSync(join(cwd, 'fixture'), 'dirty');
	assert.throws(() => planBump('patch', cwd), /clean/);
	git(['checkout', '--', 'fixture'], cwd);
	git(['checkout', '-b', 'feature'], cwd);
	assert.throws(() => planBump('patch', cwd), /main/);
});

test('bump planning rejects a release tag outside main history', (t) => {
	const cwd = gitFixture(t);
	git(['checkout', '-b', 'other'], cwd);
	writeFileSync(join(cwd, 'fixture'), 'other');
	git(['commit', '-am', 'other'], cwd);
	git(['tag', 'v9.0.0'], cwd);
	git(['checkout', 'main'], cwd);
	assert.throws(() => planBump('patch', cwd));
});
