import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { androidVersionCode, resolveVersion } from './version.mjs';

export function prepareNativeVersion(metadata = resolveVersion()) {
	const { version } = metadata;
	const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
	config.version = version;
	config.bundle.android = { ...config.bundle.android, versionCode: androidVersionCode(version) };
	if (process.env.NATIVE_DESKTOP === 'true') {
		config.bundle.createUpdaterArtifacts = true;
	}
	writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(config, null, '\t') + '\n');
	const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').replace(
		/^version = ".*"/m,
		`version = "${version}"`
	);
	writeFileSync('src-tauri/Cargo.toml', cargo);
	const lockPath = 'src-tauri/Cargo.lock';
	const lock = readFileSync(lockPath, 'utf8');
	writeFileSync(
		lockPath,
		lock.replace(
			/(\[\[package\]\]\r?\nname = "kartkoweczka"\r?\nversion = ")[^"]+("\r?\n)/,
			`$1${version}$2`
		)
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
	prepareNativeVersion();
