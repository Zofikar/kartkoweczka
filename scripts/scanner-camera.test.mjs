import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/camera.ts', import.meta.url), 'utf8');
const implementation = ts.transpile(source.replace('export function', 'function'), {
	target: ts.ScriptTarget.ES2022,
});
const createCamera = new Function(`${implementation}; return createCamera;`)();

function setup(open) {
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: { mediaDevices: { getUserMedia: open } },
	});
	const video = { srcObject: null, play: async () => {} };
	const camera = createCamera();
	camera.initialize(video);
	return { camera, video };
}

test('prefers high resolution 4:3 and releases the preview on stop', async () => {
	let requested;
	let stopped = 0;
	const track = { getCapabilities: () => ({}), stop: () => stopped++ };
	const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
	const { camera, video } = setup(async (options) => {
		requested = options;
		return stream;
	});
	assert.equal(await camera.startCamera(), true);
	assert.equal(requested.video.aspectRatio.ideal, 4 / 3);
	assert.equal(requested.video.width.ideal, 3200);
	assert.equal(video.srcObject, stream);
	assert.equal(await camera.feedback({ torch: true }), false);
	camera.stopCamera();
	assert.equal(stopped, 1);
	assert.equal(video.srcObject, null);
});

test('cancelled permission prompt releases late stream', async () => {
	let resolve;
	let stopped = 0;
	const { camera, video } = setup(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	const pending = camera.startCamera();
	camera.stopCamera();
	resolve({ getTracks: () => [{ stop: () => stopped++ }] });
	assert.equal(await pending, false);
	assert.equal(stopped, 1);
	assert.equal(video.srcObject, null);
});

test('torch preserves capture constraints and stale completion is ignored', async () => {
	let resolve;
	let applied;
	const track = {
		stop() {},
		getCapabilities: () => ({ torch: true }),
		applyConstraints: (value) => {
			applied = value;
			return new Promise((done) => {
				resolve = done;
			});
		},
	};
	const { camera } = setup(async () => ({
		getTracks: () => [track],
		getVideoTracks: () => [track],
	}));
	await camera.startCamera();
	const pending = camera.feedback({ torch: true });
	assert.equal(applied.width.ideal, 3200);
	assert.deepEqual(applied.advanced, [{ torch: true }]);
	camera.stopCamera();
	resolve();
	assert.equal(await pending, false);
});
