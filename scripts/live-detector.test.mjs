import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

test('live detector resolves worker revisions on the main thread and forwards lookup errors', async () => {
	const source = readFileSync(new URL('../src/utils/liveDetector.ts', import.meta.url), 'utf8');
	const implementation = ts.transpile(
		source
			.replace(/import \{ getRevisionAnswerCounts \}[^\n]+/, '')
			.replaceAll('import.meta.url', "'https://tauri.localhost/assets/scanner.js'")
			.replace('export function', 'function'),
		{ target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	);
	let worker;
	const messages = [];
	class Worker {
		constructor() {
			// eslint-disable-next-line @typescript-eslint/no-this-alias -- Capture the fake worker to deliver test messages.
			worker = this;
		}
		postMessage(message) {
			messages.push(message);
		}
		terminate() {}
	}
	class OffscreenCanvas {
		getContext() {
			return { drawImage() {} };
		}
		transferToImageBitmap() {
			return { close() {} };
		}
	}
	let lookupError;
	const lookup = async (revisionId) => {
		assert.equal(revisionId, 'revision');
		if (lookupError) throw lookupError;
		return new Uint8Array([4, 2]);
	};
	const create = new Function(
		'Worker',
		'OffscreenCanvas',
		'getRevisionAnswerCounts',
		`${implementation.replace(/export \{\};?/, '')}; return createLiveDetector;`
	)(Worker, OffscreenCanvas, lookup);
	const detector = create();
	const video = { videoWidth: 640, videoHeight: 480 };
	const pending = detector.analyze(video, 'en');
	worker.onmessage({ data: { revisionId: 'revision' } });
	await Promise.resolve();
	assert.deepEqual(messages.at(-1), { answerCounts: new Uint8Array([4, 2]) });
	const result = { diagnostics: {}, quality: {}, duration: 1, timings: {} };
	worker.onmessage({ data: result });
	assert.equal(await pending, result);

	lookupError = new Error('Unknown revision');
	const failed = detector.analyze(video, 'en');
	worker.onmessage({ data: { revisionId: 'revision' } });
	await Promise.resolve();
	assert.deepEqual(messages.at(-1), { answerCountsError: 'Unknown revision' });
	worker.onmessage({ data: { error: 'Unknown revision' } });
	await assert.rejects(failed, /Unknown revision/);
	detector.stop(true);
});
