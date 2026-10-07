import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './version.mjs';

export function gitFixture(t, tag = 'v1.2.3') {
	const cwd = mkdtempSync(join(tmpdir(), 'version-test-'));
	t.after(() => rmSync(cwd, { recursive: true, force: true }));
	git(['init', '-b', 'main'], cwd);
	git(['config', 'user.email', 'test@example.com'], cwd);
	git(['config', 'user.name', 'Version test'], cwd);
	writeFileSync(join(cwd, 'fixture'), 'initial');
	git(['add', '.'], cwd);
	git(['commit', '-m', 'initial'], cwd);
	git(['tag', '-a', tag, '-m', tag], cwd);
	return cwd;
}
