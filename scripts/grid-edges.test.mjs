import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/gridEdges.ts', import.meta.url), 'utf8');
const code = ts.transpile(source.replaceAll('export ', ''), { target: ts.ScriptTarget.ES2022 });
const collectGridEdges = new Function(`${code}; return collectGridEdges;`)();

function frame(draw) {
	const data = new Uint8ClampedArray(1800 * 2050 * 4).fill(255);
	const ink = (x, y) => {
		const index = (y * 1800 + x) * 4;
		data[index] = data[index + 1] = data[index + 2] = 0;
	};
	draw(ink);
	return { width: 1800, height: 2050, data };
}

test('collects offset horizontal and vertical borders without altering image', () => {
	const image = frame((ink) => {
		for (let row = 0; row < 3; row++) for (let x = 70; x < 350; x++) ink(x, 237 + row * 84);
		for (let col = 0; col < 3; col++) for (let y = 232; y < 500; y++) ink(74 + col * 84, y);
	});
	const edges = collectGridEdges(image);
	assert.equal(edges.length, 2);
	assert.ok(Math.abs(edges[0].offset - 5) < 3);
	assert.ok(Math.abs(edges[1].offset - 4) < 3);
	assert.ok(edges.every((edge) => Math.abs(edge.tiltDegrees) < 0.1 && edge.coverage > 0.9));
});

test('rejects blank images and borders outside bounded bands', () => {
	assert.deepEqual(collectGridEdges(frame(() => {})), []);
	assert.deepEqual(
		collectGridEdges(
			frame((ink) => {
				for (let x = 80; x < 230; x++) ink(x, 280);
			})
		),
		[]
	);
});

test('reports sloped top border', () => {
	const edges = collectGridEdges(
		frame((ink) => {
			for (let row = 0; row < 3; row++)
				for (let x = 70; x < 350; x++) ink(x, Math.round(232 + row * 84 + (x - 150) * 0.08));
		})
	);
	assert.equal(edges.length, 1);
	assert.ok(edges[0].tiltDegrees > 3 && edges[0].tiltDegrees < 6);
});

test('rejects internal separator when the real outside border is visible', () => {
	const edges = collectGridEdges(
		frame((ink) => {
			for (const x of [0, 84, 168, 252]) for (let y = 232; y < 500; y++) ink(x, y);
		})
	);
	assert.equal(
		edges.some((edge) => edge.axis === 'left'),
		false
	);
});

test('rejects isolated lines without a matching grid lattice', () => {
	assert.deepEqual(
		collectGridEdges(
			frame((ink) => {
				for (let x = 70; x < 350; x++) ink(x, 232);
			})
		),
		[]
	);
});
