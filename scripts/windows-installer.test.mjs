import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Windows installer checks write access without shutting down unrelated processes', () => {
	const config = JSON.parse(
		readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')
	);
	assert.equal(config.bundle.windows.nsis.installerHooks, 'windows/installer-hooks.nsh');
	const hooks = readFileSync(
		new URL('../src-tauri/windows/installer-hooks.nsh', import.meta.url),
		'utf8'
	);
	assert.match(hooks, /!macroundef CheckIfAppIsRunning/);
	assert.match(hooks, /CreateFileW.*0x40000000, i 7.*i 3/);
	assert.match(hooks, /CloseHandle/);
	assert.match(hooks, /p \.r0 \?e/);
	assert.match(hooks, /\$2 != 5/);
	assert.match(hooks, /\$2 != 32/);
	assert.match(hooks, /Windows error \$2/);
	assert.match(hooks, /\$1 < 30/);
	assert.doesNotMatch(hooks, /RmShutdown|KillProcess|taskkill/);
});
