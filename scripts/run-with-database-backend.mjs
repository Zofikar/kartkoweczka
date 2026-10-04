import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);

if (!command) {
	throw new Error('A command is required.');
}

const child = spawn(command, args, {
	stdio: 'inherit',
	shell: process.platform === 'win32',
	env: {
		...process.env,
		DATABASE_BACKEND: 'tauri',
	},
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exitCode = code ?? 1;
});
