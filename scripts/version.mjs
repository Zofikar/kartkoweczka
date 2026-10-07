import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const stableTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function git(args, cwd = process.cwd()) {
	return execFileSync('git', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

export function androidVersionCode(version) {
	if (!stableTag.test(`v${version}`)) throw new Error('Expected a stable X.Y.Z version');
	const [major, minor, patch] = version.split('.').map(Number);
	const code = major * 1000000 + minor * 1000 + patch;
	if (minor > 999 || patch > 999 || !Number.isSafeInteger(code) || code < 1 || code > 2100000000)
		throw new Error('Version exceeds the Android versionCode bounds');
	return code;
}

export function resolveVersion({ cwd = process.cwd(), env = process.env } = {}) {
	const releaseTag = env.RELEASE_TAG;
	if (releaseTag && !stableTag.test(releaseTag)) throw new Error('Use a stable vX.Y.Z tag');
	let snapshot;
	if (env.BUILD_VERSION_JSON) {
		snapshot = JSON.parse(env.BUILD_VERSION_JSON);
		if (
			!stableTag.test(`v${snapshot.version}`) ||
			typeof snapshot.displayVersion !== 'string' ||
			!/^([0-9a-f]{40,64})?$/.test(snapshot.commit) ||
			typeof snapshot.dirty !== 'boolean'
		)
			throw new Error('Invalid BUILD_VERSION_JSON metadata');
		androidVersionCode(snapshot.version);
	}
	// A parent process resolves once, before stamping native manifests. Docker can use
	// this same explicit handoff without copying .git into its build context.
	if (env.BUILD_VERSION_JSON && !releaseTag) {
		return snapshot;
	}
	let commit;
	try {
		commit = git(['rev-parse', 'HEAD'], cwd);
	} catch {
		if (releaseTag) throw new Error('Official releases require Git history');
		return { version: '0.0.1', displayVersion: '0.0.1-dev', commit: '', dirty: false };
	}
	const tags = git(['tag', '--list'], cwd)
		.split('\n')
		.filter((tag) => stableTag.test(tag));
	const dirty = Boolean(git(['status', '--porcelain', '--untracked-files=no'], cwd));
	if (releaseTag) {
		if (git(['rev-parse', `${releaseTag}^{commit}`], cwd) !== commit)
			throw new Error('Release tag does not point to HEAD');
		// Native stamping is an intentional checkout modification. Release jobs
		// resolve and validate cleanliness before stamping, then reuse the snapshot.
		if (snapshot) {
			if (
				snapshot.commit !== commit ||
				snapshot.version !== releaseTag.slice(1) ||
				snapshot.displayVersion !== snapshot.version ||
				snapshot.dirty
			)
				throw new Error('Release metadata does not match the clean tagged checkout');
			return snapshot;
		}
		if (dirty) throw new Error('Official releases require a clean checkout');
		const version = releaseTag.slice(1);
		androidVersionCode(version);
		return { version, displayVersion: version, commit, dirty: false };
	}
	let description;
	try {
		if (!tags.length) throw new Error('No stable tags');
		description = git(
			['describe', '--tags', '--long', '--abbrev=7', ...tags.flatMap((tag) => ['--match', tag])],
			cwd
		);
	} catch {
		return {
			version: '0.0.1',
			displayVersion: `0.0.1-dev-g${commit.slice(0, 7)}${dirty ? '-dirty' : ''}`,
			commit,
			dirty,
		};
	}
	const [, tag, distance, hash] = /^(v\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)$/.exec(description);
	const version = tag.slice(1);
	androidVersionCode(version);
	return {
		version,
		displayVersion: `${distance === '0' ? version : `${version}-${distance}-g${hash}`}${dirty ? '-dirty' : ''}`,
		commit,
		dirty,
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const metadata = resolveVersion();
	const json = JSON.stringify(metadata);
	if (process.argv.includes('--github-env')) {
		if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required');
		appendFileSync(process.env.GITHUB_ENV, `BUILD_VERSION_JSON=${json}\n`);
	}
	console.log(json);
}
