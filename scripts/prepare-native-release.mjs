import { readFileSync, writeFileSync } from 'node:fs';

const version = process.env.RELEASE_TAG?.replace(/^v/, '');
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use a stable vX.Y.Z tag');
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
config.version = pkg.version = version;
if (process.env.NATIVE_DESKTOP === 'true') {
	if (!process.env.TAURI_UPDATER_PUBLIC_KEY?.trim()) {
		throw new Error(
			'Missing TAURI_UPDATER_PUBLIC_KEY: configure a GitHub Actions repository variable or secret with the complete updater public key file contents.'
		);
	}
	config.bundle.createUpdaterArtifacts = true;
	config.plugins = {
		...config.plugins,
		updater: {
			pubkey: process.env.TAURI_UPDATER_PUBLIC_KEY,
			endpoints: [
				`https://github.com/${process.env.GITHUB_REPOSITORY}/releases/latest/download/version_mainfest.json`,
			],
		},
	};
}
writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(config, null, '\t') + '\n');
writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n');
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').replace(
	/^version = ".*"/m,
	`version = "${version}"`
);
writeFileSync('src-tauri/Cargo.toml', cargo);
