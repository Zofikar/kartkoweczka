import assert from "node:assert/strict";
import createOpenOmr from "../build/wasm/wasm/openOmr.js";

const module = await createOpenOmr();

function makeBytes(values) {
    const result = new module.Vector_Bytes();
    for (const value of values) result.push_back(value);
    return result;
}

function readBytes(values) {
    return Uint8Array.from(values);
}

const encoder = new TextEncoder();

// Global functions exercise std::vector<uint8_t>, value objects, enums,
// optional arguments, returned vectors, and nested returned byte vectors.
const qrPayload = makeBytes(encoder.encode("openOmr wasm smoke"));
const qr = module.generateQr(qrPayload, {width: 240, height: 240});
assert.equal(qr.width, 240);
assert.equal(qr.height, 240);
assert.equal(qr.layout.value, module.PixelLayout.Gray.value);
assert.equal(qr.data.size(), 240 * 240);
assert.equal(module.checkImageQuality(qr).value, module.ImageQuality.Good.value);

const qrDetections = module.detectQrCode(qr);
assert.equal(qrDetections.size(), 1);
const qrDetection = qrDetections.get(0);
assert.equal(
    new TextDecoder().decode(readBytes(qrDetection.data)),
    "openOmr wasm smoke",
);

const revisionId = Uint8Array.from([
    0x10, 0x21, 0x32, 0x43, 0x54, 0x65, 0x47, 0x87,
    0x98, 0xa9, 0xba, 0xcb, 0xdc, 0xed, 0xfe, 0x0f,
]);
const generator = new module.SheetGenerator();
generator.initialize({width: 1800, height: 2050}, revisionId);
assert.equal(generator.setFont(new Uint8Array()), true);
assert.equal(generator.addQuestion(1, 0, [
    encoder.encode("A"), encoder.encode("B"),
    encoder.encode("C"), encoder.encode("D"),
]), true);
assert.equal(generator.addQuestion(2, 1, [
    encoder.encode("T"), encoder.encode("F"),
]), true);

const sheet = generator.generate();
assert.equal(sheet.width, 1800);
assert.equal(sheet.height, 2050);
assert.equal(sheet.layout.value, module.PixelLayout.Gray.value);
assert.equal(sheet.data.size(), 1800 * 2050);

// Mark question 1, answer C in the JavaScript-owned image representation.
// Grid origin=(70,220), cell=84, answer C center=(364,262), inner=42.
for (let y = 246; y < 279; ++y) {
    for (let x = 348; x < 381; ++x) {
        sheet.data.set(y * sheet.width + x, 0);
    }
}

const grader = new module.SheetGrader();
const aruco = grader.detectAruco(sheet);
assert.equal(aruco.size(), 5);
assert.deepEqual(
    Array.from(aruco, detection => detection.id).sort((a, b) => a - b),
    [26, 26, 26, 26, 31],
);
assert.equal(grader.normalize({width: 1800, height: 2050}), true);

const normalized = grader.normalizedImage();
assert.equal(normalized.width, 1800);
assert.equal(normalized.height, 2050);
assert.equal(normalized.layout.value, module.PixelLayout.Gray.value);
assert.equal(normalized.data.size(), 1800 * 2050);

const revision = grader.detectRevisionId();
assert.ok(revision);
assert.deepEqual(readBytes(revision.revisionId), revisionId);

const grades = grader.gradeSheet(
    {width: 84, height: 84},
    {width: 42, height: 42},
);
assert.deepEqual(Array.from(grades), [0b0100, 0]);

// Delete every Embind-owned handle returned or constructed above. This also
// verifies that generated classes expose the expected ownership API.
grades.delete();
revision.revisionId.delete();
normalized.data.delete();
aruco.delete();
grader.delete();
sheet.data.delete();
generator.delete();
qrDetection.data.delete();
qrDetections.delete();
qr.data.delete();
qrPayload.delete();

console.log("Wasm binding smoke test passed");