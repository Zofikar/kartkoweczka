import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveVersion } from './version.mjs';
import { prepareNativeVersion } from './prepare-native-release.mjs';

const metadata = resolveVersion();
const files = ['src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
const originals = files.map((file) => readFileSync(file));
try {
	prepareNativeVersion(metadata);
	const result = spawnSync(
		process.execPath,
		['node_modules/@tauri-apps/cli/tauri.js', ...process.argv.slice(2)],
		{
			stdio: 'inherit',
			env: { ...process.env, BUILD_VERSION_JSON: JSON.stringify(metadata) },
		}
	);
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
} finally {
	files.forEach((file, index) => writeFileSync(file, originals[index]));
}
