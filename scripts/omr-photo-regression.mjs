import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import createOpenOmr from '../src/wasm/openOmr.js';

// JPEG decoding uses the same Python/OpenCV environment as local image analysis.
// Run from any directory: node scripts/omr-photo-regression.mjs
const root = fileURLToPath(new URL('../', import.meta.url));
const cases = [
	['IMG_20261007_164939.jpg', [0, 0, 0, 0, 0, 0, 0, 0], []],
	['IMG_20261007_165133.jpg', [2, 1, 8, 3, 1, 1, 2, 2], ['row 2 answer 2']],
	['IMG_20261022_164625.jpg', [0, 0, 0, 0, 0, 0, 0, 0], []],
	['IMG_20261022_180456.jpg', [2, 1, 8, 3, 1, 1, 2, 1], ['row 3 answer 3']],
	['IMG_20261022_180646.jpg', [2, 1, 8, 3, 1, 1, 2, 1], ['row 3 answer 3']],
	['IMG_20261022_180733.jpg', [2, 1, 8, 3, 1, 1, 2, 1], ['row 3 answer 3']],
];
const module = await createOpenOmr();
const temporary = mkdtempSync(join(tmpdir(), 'omr-photos-'));
try {
	for (const [name, expected, corrections] of cases) {
		const rawPath = join(temporary, 'image.rgba');
		const dimensions = execFileSync(
			'python',
			[
				'-c',
				'import cv2,sys; a=cv2.imread(sys.argv[1]); assert a is not None; cv2.cvtColor(a,cv2.COLOR_BGR2RGBA).tofile(sys.argv[2]); print(a.shape[1],a.shape[0])',
				resolve(root, 'test_images', name),
				rawPath,
			],
			{ encoding: 'utf8' }
		);
		const [width, height] = dimensions.trim().split(/\s+/).map(Number);
		const data = new module.Vector_Bytes();
		const grader = new module.SheetGrader();
		try {
			const raw = readFileSync(rawPath);
			data.resize(raw.length, 0);
			module.byteVectorView(data).set(raw);
			const markers = grader.detectAruco({ data, width, height, layout: module.PixelLayout.RGBA });
			try {
				assert.ok(markers.size() >= 3, `${name}: markers`);
			} finally {
				markers.delete();
			}
			assert.ok(grader.normalize({ width: 1800, height: 2050 }), `${name}: normalization`);
			const revision = grader.detectRevisionId();
			assert.ok(revision, `${name}: revision`);
			revision.revisionId.delete();
			grader.setAnswerCounts(new Uint8Array(expected.length).fill(4));
			const answers = grader.gradeSheet({ width: 84, height: 84 }, { width: 42, height: 42 });
			try {
				assert.deepEqual(Array.from(answers), expected, `${name}: answers`);
			} finally {
				answers.delete();
			}
			const diagnostics = grader.overlayDiagnostics();
			let overlays;
			try {
				overlays = JSON.parse(new TextDecoder().decode(Uint8Array.from(diagnostics)));
			} finally {
				diagnostics.delete();
			}
			for (const correction of corrections) {
				assert.ok(
					overlays.some(
						(o) => o.kind === 'corrected' && o.label === `${correction} correction detected`
					),
					`${name}: ${correction}`
				);
			}
			console.log(`PASS ${name}: ${expected.join(', ')}`);
		} finally {
			grader.delete();
			data.delete();
		}
	}
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
