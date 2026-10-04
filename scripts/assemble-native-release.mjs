import { readdirSync, readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const version = process.env.RELEASE_TAG.replace(/^v/, '');
const url = `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/${process.env.RELEASE_TAG}/`;
const manifest = {
	version,
	notes: `Kartkóweczka ${version}`,
	pub_date: new Date().toISOString(),
	platforms: {},
	downloads: {},
	packages: {},
};
mkdirSync('release', { recursive: true });
function walk(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
	);
}
for (const [platform, key, extension] of [
	['Windows_x64', 'windows-x86_64', '.exe'],
	['Linux_x64', 'linux-x86_64-appimage', '.AppImage'],
	['Linux_arm', 'linux-aarch64-appimage', '.AppImage'],
	['Linux_x64', 'linux-x86_64-deb', '.deb'],
	['Linux_arm', 'linux-aarch64-deb', '.deb'],
	['Android_arm', null, '.apk'],
]) {
	const files = walk(join('artifacts', platform));
	const candidates = files.filter((file) => file.endsWith(extension));
	if (candidates.length !== 1)
		throw new Error(`Expected exactly one installer for ${platform}: ${candidates}`);
	const installer = candidates[0];
	const name = `Kartkoweczka-${version}-${platform}${extension}`;
	copyFileSync(installer, join('release', name));
	if (extension !== '.deb') manifest.downloads[platform] = url + name;
	manifest.packages[platform] ??= {};
	manifest.packages[platform][extension.slice(1).toLowerCase()] = url + name;
	if (key) {
		const signature = readFileSync(installer + '.sig', 'utf8').trim();
		if (!signature) throw new Error(`Missing signature for ${basename(installer)}`);
		manifest.platforms[key] = { signature, url: url + name };
		// Preserve the original generic AppImage target for older clients.
		if (extension === '.AppImage') {
			manifest.platforms[key.replace(/-appimage$/, '')] = manifest.platforms[key];
		}
		writeFileSync(join('release', name + '.sig'), signature);
	}
}
const json = JSON.stringify(manifest, null, '\t');
writeFileSync('release/version_mainfest.json', json + '\n');
writeFileSync(
	'release-notes.md',
	`${manifest.notes}\n\n<!-- native-manifest -->\n\`\`\`json\n${json}\n\`\`\`\n`
);
