import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
const artifact = process.env.OMR_BENCHMARK_MODULE
	? pathToFileURL(resolve(process.env.OMR_BENCHMARK_MODULE))
	: new URL('../src/wasm/openOmr.js', import.meta.url);
const { default: createOpenOmr } = await import(artifact.href);
const measuredIterations = Number(process.env.OMR_BENCHMARK_ITERATIONS ?? 6);
assert.ok(Number.isInteger(measuredIterations) && measuredIterations > 0);

const directory = resolve(process.argv[2] ?? 'openOmr/build/capture-fixtures');
const output = resolve(process.argv[3] ?? '.agents/memory/debug/omr-benchmark.json');
const module = await createOpenOmr();
const source = readFileSync(new URL('../src/utils/gridEdges.ts', import.meta.url), 'utf8');
const code = ts.transpile(source.replaceAll('export ', ''), { target: ts.ScriptTarget.ES2022 });
const collect = new Function(`${code}; return collectGridEdges;`)();
const encoder = new TextEncoder();
const generator = new module.SheetGenerator();
generator.initialize(
	{ width: 1800, height: 2050 },
	Uint8Array.from([
		0x10, 0x21, 0x32, 0x43, 0x54, 0x65, 0x47, 0x87, 0x98, 0xa9, 0xba, 0xcb, 0xdc, 0xed, 0xfe, 0x0f,
	])
);
generator.setFont(new Uint8Array());
for (let row = 1; row <= 5; row++)
	generator.addQuestion(
		row,
		0,
		['A', 'B', 'C', 'D'].map((x) => encoder.encode(x))
	);
const generated = generator.generate();
const pixels = module.byteVectorView(generated.data).slice();
const rgba = new Uint8ClampedArray(1800 * 2050 * 4).fill(255);
for (let i = 0; i < pixels.length; i++) rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = pixels[i];
const pristineGrid = collect({ width: 1800, height: 2050, data: rgba });
assert.equal(pristineGrid.length, 2);
assert.ok(
	pristineGrid.every((edge) => Math.abs(edge.offset) < 3 && Math.abs(edge.tiltDegrees) < 0.2)
);
const fixtures = [{ name: 'generated', pixels: rgba, grid: pristineGrid }];
for (const name of readdirSync(directory)
	.filter((name) => name.endsWith('.bgra'))
	.sort()) {
	const bgra = readFileSync(resolve(directory, name));
	const original = name.endsWith('-original.bgra');
	const width = original ? 2448 : 1800;
	const height = original ? 3264 : 2050;
	assert.equal(bgra.length, width * height * 4);
	const rgbaPixels = new Uint8ClampedArray(bgra.length);
	for (let offset = 0; offset < bgra.length; offset += 4) {
		rgbaPixels[offset] = bgra[offset + 2];
		rgbaPixels[offset + 1] = bgra[offset + 1];
		rgbaPixels[offset + 2] = bgra[offset];
		rgbaPixels[offset + 3] = bgra[offset + 3];
	}
	assert.equal(rgbaPixels[0], bgra[2]);
	assert.equal(rgbaPixels[2], bgra[0]);
	fixtures.push({
		name,
		pixels: rgbaPixels,
		width,
		height,
		grid: original ? [] : collect({ width, height, data: rgbaPixels }),
	});
}
const results = [];
for (const fixture of fixtures.filter(
	(fixture) =>
		!process.env.OMR_BENCHMARK_FILTER || fixture.name.startsWith(process.env.OMR_BENCHMARK_FILTER)
)) {
	const bytes = new module.Vector_Bytes();
	bytes.resize(fixture.pixels.length, 0);
	module.byteVectorView(bytes).set(fixture.pixels);
	const image = {
		data: bytes,
		width: fixture.width ?? 1800,
		height: fixture.height ?? 2050,
		layout: module.PixelLayout.RGBA,
	};
	const samples = [];
	for (let iteration = 0; iteration < measuredIterations + 2; iteration++) {
		const grader = new module.SheetGrader();
		const start = performance.now();
		const markers = grader.detectAruco(image);
		const discovered = performance.now();
		const normalized = markers.size() >= 3 && grader.normalize({ width: 1800, height: 2050 });
		const warped = performance.now();
		const revision = normalized ? grader.detectRevisionId() : undefined;
		const decodedAt = performance.now();
		const grades = revision
			? grader.gradeSheet({ width: 84, height: 84 }, { width: 42, height: 42 })
			: undefined;
		const answers = grades ? Array.from(grades) : null;
		grades?.delete();
		const end = performance.now();
		if (
			iteration == 0 &&
			normalized &&
			(fixture.name.startsWith('c428e472') || fixture.name.startsWith('1bcc6b14'))
		) {
			const warp = grader.normalizedImage();
			const raw = module.byteVectorView(warp.data);
			const channels = raw.length / (warp.width * warp.height);
			const crop = Buffer.alloc(264 * 264 * 3);
			for (let y = 0; y < 264; y++)
				for (let x = 0; x < 264; x++) {
					const index = ((1756 + y) * warp.width + 1306 + x) * channels;
					for (let c = 0; c < 3; c++)
						crop[(y * 264 + x) * 3 + c] = raw[index + (channels === 1 ? 0 : c)];
				}
			writeFileSync(
				resolve('.agents/memory/debug/camera-images', fixture.name.slice(0, 8) + '-offline-qr.ppm'),
				Buffer.concat([Buffer.from('P6\n264 264\n255\n'), crop])
			);
			warp.data.delete();
		}

		// Read diagnostics outside the timed pipeline, including rejected warps.
		const diagnosticBytes = grader.alignmentDiagnostics();
		let alignmentDetails;
		try {
			alignmentDetails = new TextDecoder().decode(Uint8Array.from(diagnosticBytes));
		} finally {
			diagnosticBytes.delete();
		}
		const rejectionReason =
			markers.size() < 3
				? 'Insufficient detected markers: normalization not attempted.'
				: !normalized
					? alignmentDetails.trim() || 'Normalization rejected without a diagnostic from WASM.'
					: !revision
						? 'Revision decoding failed in the normalized QR region.'
						: null;
		if (iteration >= 2)
			samples.push({
				markers: discovered - start,
				normalization: warped - discovered,
				qr: decodedAt - warped,
				grading: end - decodedAt,
				answers,
				total: end - start,
				normalized,
				decoded: revision !== undefined && revision !== null,
				markerCount: markers.size(),
				alignmentDetails,
				rejectionReason,
			});

		markers.delete();
		grader.delete();
	}
	results.push({ name: fixture.name, grid: fixture.grid, samples });
	writeFileSync(output, JSON.stringify({ partial: true, results }));
	console.log(`Completed ${fixture.name}: ${samples.length} measured iterations`);
	bytes.delete();
}
generated.data.delete();
generator.delete();
writeFileSync(
	output,
	JSON.stringify(
		{
			node: process.version,
			flags: process.execArgv,
			pixelLayout: 'RGBA',
			wasmSha256: createHash('sha256')
				.update(readFileSync(new URL('openOmr.wasm', artifact)))
				.digest('hex'),
			results,
		},
		null,
		2
	)
);
console.log(`Saved ${results.length} fixtures to ${output}`);
