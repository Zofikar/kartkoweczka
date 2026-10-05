import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the actual component function with controlled camera state, without a browser.
const component = readFileSync(
	new URL('../src/pages/scanner/page.svelte', import.meta.url),
	'utf8'
);
const script = component.match(/<script lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('scanner.ts', script, ts.ScriptTarget.Latest, true);
const torchFunction = ast.statements.find(
	(node) => ts.isFunctionDeclaration(node) && node.name?.text === 'setTorch'
);
const implementation = ts.transpile(torchFunction.getText(ast), {
	target: ts.ScriptTarget.ES2022,
});

function createCamera() {
	return new Function(`
		let cameraSession = 0, stream = null, torch = false, torchSupported = true;
		let trackConstraints = {}, candidateKey, candidateFrames = 0;
		${implementation}
		return {
			setTorch,
			restart(nextStream) {
				cameraSession++;
				stream = nextStream;
				torch = false;
				trackConstraints = {width: {ideal: 1920}};
				candidateKey = 'new-session';
				candidateFrames = 1;
			},
			state() { return {torch, trackConstraints, candidateKey, candidateFrames}; }
		};
	`)();
}

for (const restarted of [false, true]) {
	test(`pending torch completion cannot overwrite state after ${restarted ? 'restart' : 'cancellation'}`, async () => {
		let resolve;
		const pending = new Promise((done) => {
			resolve = done;
		});
		const camera = createCamera();
		camera.restart({ getVideoTracks: () => [{ applyConstraints: () => pending }] });
		const oldOperation = camera.setTorch(true);
		const applied = [];
		const newTrack = { applyConstraints: async (constraints) => applied.push(constraints) };
		camera.restart(restarted ? { getVideoTracks: () => [newTrack] } : null);
		const before = camera.state();
		resolve();
		assert.equal(await oldOperation, false);
		assert.deepEqual(camera.state(), before);
		if (restarted) {
			assert.equal(await camera.setTorch(true), true);
			assert.equal(applied.length, 1);
			assert.equal(camera.state().torch, true);
			assert.equal(camera.state().candidateKey, undefined);
			assert.equal(camera.state().candidateFrames, 0);
			assert.deepEqual(applied[0], { width: { ideal: 1920 }, advanced: [{ torch: true }] });
		}
	});
}
