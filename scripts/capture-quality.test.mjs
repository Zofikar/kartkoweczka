import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/captureQuality.ts', import.meta.url), 'utf8');
const implementation = ts.transpile(source.replaceAll('export ', ''), {
	target: ts.ScriptTarget.ES2022,
});
const { measureCaptureQuality, createLightingPolicy } = new Function(
	`${implementation}; return { measureCaptureQuality, createLightingPolicy };`
)();

function image(pixel) {
	const data = new Uint8ClampedArray(96 * 96 * 4);
	for (let y = 0; y < 96; y++)
		for (let x = 0; x < 96; x++) {
			const offset = (y * 96 + x) * 4;
			data.fill(pixel(x, y), offset, offset + 3);
			data[offset + 3] = 255;
		}
	return { width: 96, height: 96, data };
}

test('white paper is not classified as dark and uniform exposure has no spatial spread', () => {
	const measured = measureCaptureQuality(image(() => 255));
	assert.equal(measured.dark, false);
	assert.equal(measured.clipped, 1);
	assert.equal(measured.illuminationSpread, 0);
});

test('sheet region avoids a dark surrounding desk', () => {
	const frame = image((x, y) => (x >= 30 && x < 66 && y >= 30 && y < 66 ? 220 : 15));
	const markers = Array.from({ length: 3 }, () => ({
		corners: [
			{ x: 30, y: 30 },
			{ x: 66, y: 66 },
		],
	}));
	assert.equal(measureCaptureQuality(frame).dark, true);
	const measured = measureCaptureQuality(frame, markers);
	assert.equal(measured.region, 'sheet');
	assert.equal(measured.dark, false);
});

test('tile backgrounds expose uneven lighting', () => {
	const measured = measureCaptureQuality(image((x) => (x < 48 ? 80 : 220)));
	assert.equal(measured.illuminationSpread, 140);
	assert.equal(measured.contrast, 140);
});

const dark = {
	region: 'sheet',
	brightness: 80,
	contrast: 80,
	clipped: 0,
	illuminationSpread: 10,
	dark: true,
};

test('lighting waits for exposure and sustained darkness and tries only once', () => {
	const policy = createLightingPolicy(0);
	assert.equal(policy.next(dark, false, false, 1000), undefined);
	assert.equal(policy.next(dark, false, false, 2000), undefined);
	assert.equal(policy.next(dark, false, false, 2100), undefined);
	assert.equal(policy.next(dark, false, false, 2200), true);
	policy.applied(2200);
	assert.equal(policy.next(dark, false, true, 2500), undefined);
	assert.equal(policy.next(dark, false, false, 4000), undefined);
});

test('washout rolls back once without oscillation; manual control disables policy', () => {
	const policy = createLightingPolicy(0);
	for (const time of [2000, 2100, 2200]) policy.next(dark, false, false, time);
	policy.applied(2200);
	assert.equal(policy.next({ ...dark, clipped: 0.6, contrast: 10 }, false, true, 4000), false);
	assert.equal(policy.next(dark, false, false, 5000), undefined);
	policy.manual();
	assert.equal(policy.next(dark, false, true, 6000), undefined);
});

test('readable frames never trigger a lighting experiment', () => {
	const policy = createLightingPolicy(0);
	for (const time of [2000, 2100, 2200, 2300])
		assert.equal(policy.next(dark, true, false, time), undefined);
});

test('local sheet shadow triggers lighting even when global brightness is adequate', () => {
	const markers = Array.from({ length: 3 }, () => ({
		corners: [
			{ x: 0, y: 0 },
			{ x: 96, y: 96 },
		],
	}));
	const measured = measureCaptureQuality(
		image((x) => (x < 48 ? 95 : 225)),
		markers
	);
	assert.equal(measured.dark, false);
	assert.equal(measured.shadow, true);
	const policy = createLightingPolicy(0);
	assert.equal(policy.next(measured, false, false, 2000), undefined);
	assert.equal(policy.next(measured, false, false, 2100), undefined);
	assert.equal(policy.next(measured, false, false, 2200), true);
	assert.equal(measureCaptureQuality(image((x) => (x < 48 ? 95 : 225))).shadow, false);
});
