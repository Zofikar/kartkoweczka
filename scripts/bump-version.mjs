import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { androidVersionCode, git, stableTag } from './version.mjs';

export function bumpVersion(tag, bump) {
	if (!stableTag.test(tag)) throw new Error('Expected a stable vX.Y.Z tag');
	const parts = tag.slice(1).split('.').map(Number);
	const index = ['major', 'minor', 'patch'].indexOf(bump);
	if (index < 0) throw new Error('Choose major, minor, or patch');
	parts[index]++;
	for (let i = index + 1; i < parts.length; i++) parts[i] = 0;
	const version = parts.join('.');
	androidVersionCode(version);
	return `v${version}`;
}

export function planBump(bump, cwd = process.cwd()) {
	if (git(['branch', '--show-current'], cwd) !== 'main')
		throw new Error('Release bumps require main');
	if (git(['status', '--porcelain'], cwd))
		throw new Error('Release bumps require a clean checkout');
	const tags = git(['tag', '--sort=-version:refname'], cwd)
		.split('\n')
		.filter((tag) => stableTag.test(tag));
	if (!tags.length) throw new Error('Create an initial stable release tag first');
	for (const tag of tags) git(['merge-base', '--is-ancestor', `${tag}^{commit}`, 'HEAD'], cwd);
	const previous = tags[0];
	const tag = bumpVersion(previous, bump);
	if (tags.includes(tag)) throw new Error('Release tag already exists');
	return { previous, tag, commit: git(['rev-parse', 'HEAD'], cwd) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const plan = planBump(process.argv[2]);
	if (process.env.GITHUB_OUTPUT)
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			Object.entries(plan)
				.map(([key, value]) => `${key}=${value}\n`)
				.join('')
		);
	console.log(JSON.stringify(plan));
}
