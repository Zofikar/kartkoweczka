# openOmr WebAssembly API

This document describes the API distributed with:

```text
openOmr.js
openOmr.wasm
openOmr.d.ts
WASM_API.md
```

Keep `openOmr.js` and `openOmr.wasm` in the same deployed directory unless
you provide a custom Emscripten `locateFile` option.

## Load the module

`openOmr.js` is an asynchronous ES module factory. Its default export is named
`MainModuleFactory` by `openOmr.d.ts`:

```ts
import MainModuleFactory from "./openOmr.js";

const openOmr = await MainModuleFactory();
```

In a browser, serve the files over HTTP(S). If `openOmr.wasm` is hosted at a
different URL:

```ts
const openOmr = await MainModuleFactory({
  locateFile(path: string) {
    return path.endsWith(".wasm")
      ? new URL(`/wasm/${path}`, location.origin).href
      : path;
  },
});
```

## Memory ownership

The bindings use Emscripten Embind. Objects constructed with `new` and returned
vector handles own Wasm memory and must be deleted explicitly.

Owned handles include:

- `SheetGenerator`
- `SheetGrader`
- `Vector_Bytes`
- `Vector_QrDetection`
- `Vector_ArucoDetection`
- byte-vector fields inside returned `Image`, `QrDetection`, and
  `RevisionDetection` value objects

Use `try`/`finally`:

```ts
const grader = new openOmr.SheetGrader();
try {
  // use grader
} finally {
  grader.delete();
}
```

Plain value objects such as `Size`, `Point`, `View`, `Image`, and detection
records do not have `delete()`. Delete their owned vector fields instead:

```ts
const image = generator.generate();
try {
  // use image
} finally {
  image.data.delete();
}
```

## Byte values

Two byte representations appear in the API.

### `Uint8Array` parameters

These methods accept ordinary JavaScript typed arrays directly:

- `SheetGenerator.initialize(size, revisionId)`
- `SheetGenerator.setFont(fontData)`
- each label passed to `SheetGenerator.addQuestion(...)`

### `Vector_Bytes` values

The following use the Embind `Vector_Bytes` class:

- `Image.data`
- the `generateQr()` payload
- decoded QR payloads
- detected revision IDs
- grading results

Conversion helpers:

```ts
import type { MainModule, Vector_Bytes } from "./openOmr.js";

function toWasmBytes(
  openOmr: MainModule,
  source: ArrayLike<number>,
): Vector_Bytes {
  const result = new openOmr.Vector_Bytes();
  for (let index = 0; index < source.length; ++index) {
    result.push_back(source[index]);
  }
  return result;
}

function fromWasmBytes(source: Vector_Bytes): Uint8Array {
  return Uint8Array.from(source);
}
```

`Vector_Bytes` supports `size()`, `get()`, `set()`, `push_back()`, iteration,
and `delete()`.

## Enums

Embind enum values are objects with a numeric `.value`, not plain numbers:

```ts
if (image.layout.value === openOmr.PixelLayout.Gray.value) {
  // one byte per pixel
}

if (quality.value === openOmr.ImageQuality.TooDark.value) {
  // ask the user to recapture the image
}
```

## Common types

```ts
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type View = { x: number; y: number; width: number; height: number };

type Image = {
  data: Vector_Bytes;
  width: number;
  height: number;
  layout: PixelLayout;
};
```

Detection corners are `tl` (top-left), `tr` (top-right), `br` (bottom-right),
and `bl` (bottom-left).

### Image layouts

| Layout | Bytes/pixel | Byte order | Required data length |
|---|---:|---|---:|
| `PixelLayout.Gray` | 1 | grayscale intensity | `width * height` |
| `PixelLayout.RGBA` | 4 | red, green, blue, alpha | `width * height * 4` |

Passing the wrong byte count throws an exception. Browser `ImageData` already
has the required RGBA order:

```ts
function imageDataToOpenOmrImage(
  openOmr: MainModule,
  imageData: ImageData,
) {
  return {
    data: toWasmBytes(openOmr, imageData.data),
    width: imageData.width,
    height: imageData.height,
    layout: openOmr.PixelLayout.RGBA,
  };
}
```

The caller must eventually delete the returned `data` vector.

## Sheet geometry

The current logical coordinate system is:

```text
sheet:             1800 x 2050 pixels
answer cell:         84 x   84 pixels
inner answer box:    42 x   42 pixels
```

The intended print area is 180 × 205 mm, so one canonical pixel represents
0.1 mm.

```text
TL                                  TR

                         QR

BL   FB                             BR

  1   [A]  [B]  [C]  [D]
  2   [T]  [F]
```

The four corner ArUco markers encode the sheet version. `FB` is the additional
fixed-bottom marker. Public detections use canonical `DICT_4X4_50` IDs from
`3`, `5`, `25`, `26`, and `31`.

Marker IDs are not necessarily unique. For current version 64, every corner
has ID `26` and `FB` has ID `31`; positions are resolved using orientation and
geometry.

## `SheetGenerator`

```ts
const generator = new openOmr.SheetGenerator();
try {
  // initialize, add questions, generate
} finally {
  generator.delete();
}
```

### `initialize(size, revisionId): void`

```ts
generator.initialize(
  { width: 1800, height: 2050 },
  revisionId,
);
```

Requirements:

- width and height must be positive;
- `revisionId` must be a 16-byte `Uint8Array`;
- it must be an RFC 4122 UUID version 4 or version 7;
- byte 8 must contain RFC 4122 variant bits (`10xxxxxx`);
- calling `initialize()` resets all previously added questions;
- invalid input throws through the Wasm boundary.

```ts
function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll("-", "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error("Invalid UUID");
  return Uint8Array.from(
    Array.from({ length: 16 }, (_, index) =>
      Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)),
  );
}
```

### `setFont(fontData): boolean`

```ts
const response = await fetch("/fonts/arial.ttf");
const fontData = new Uint8Array(await response.arrayBuffer());

if (!generator.setFont(fontData)) {
  throw new Error("The font was rejected");
}
```

- accepts copied TTF, TTC, or OTF bytes from 12 bytes through 32 MiB;
- invalid or unsupported data returns `false`;
- `new Uint8Array()` restores the embedded default font;
- only trusted fonts should be supplied;
- the consumer is responsible for font licensing.

### `addQuestion(questionNumber, subQuestionNumber, answerLabels): boolean`

```ts
const encode = (text: string) => new TextEncoder().encode(text);

generator.addQuestion(1, 0, [
  encode("A"), encode("B"), encode("C"), encode("D"),
]);
generator.addQuestion(2, 1, [encode("T"), encode("F")]);
```

The second question is displayed as `2.1`.

The method returns `false` if:

- the generator is not initialized;
- fewer than 1 or more than 8 labels are supplied;
- a label is not 1-3 uppercase ASCII letters (`A`-`Z`);
- the `(questionNumber, subQuestionNumber)` pair already exists;
- the question would not fit on the sheet.

Labels affect printing only. A label's zero-based array position determines
its grading bit. Questions are placed in insertion order, top-to-bottom, then
in the next block. One canonical block contains 18 rows.

### `generate(): Image`

```ts
const sheet = generator.generate();
try {
  if (sheet.width === 0 || sheet.height === 0) {
    throw new Error("Sheet generation failed");
  }
  // PixelLayout.Gray; data length is width * height
} finally {
  sheet.data.delete();
}
```

Generation failure returns an empty image.

### Display a generated sheet

```ts
import type { Image } from "./openOmr.js";

function drawGrayImage(canvas: HTMLCanvasElement, image: Image): void {
  const gray = Uint8Array.from(image.data);
  const rgba = new Uint8ClampedArray(image.width * image.height * 4);

  for (let pixel = 0; pixel < gray.length; ++pixel) {
    const value = gray[pixel];
    const offset = pixel * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  }

  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(
    new ImageData(rgba, image.width, image.height), 0, 0,
  );
}
```

Render or copy the pixels before deleting `image.data`.

## `SheetGrader`

The grader is stateful. Call methods in this order:

```text
detectAruco(image)
  -> normalize(originalSheetSize)
    -> normalizedImage()
    -> detectRevisionId()
    -> gradeSheet(cellSize, innerCellSize)
```

Use a separate grader for each concurrently processed sheet.

### `detectAruco(image): Vector_ArucoDetection`

Stores a copy of the source image, detects markers, resolves positions, and
decodes the sheet version:

```ts
const detections = grader.detectAruco(image);
try {
  if (detections.size() < 4) throw new Error("Not enough sheet markers");
  for (const marker of detections) {
    console.log(marker.id, marker.tl, marker.tr, marker.br, marker.bl);
  }
} finally {
  detections.delete();
}
```

The protocol tolerates one missing landmark. Normalization requires at least
three genuine corner markers. `FB` is collinear with the bottom corners and
cannot replace a homography corner. Calling `detectAruco()` resets previous
grader state.

### `normalize(sheetOriginalSize): boolean`

```ts
if (!grader.normalize({ width: 1800, height: 2050 })) {
  throw new Error("Sheet normalization failed");
}
```

Pass the logical generation size, not the camera image size. A canonical sheet
uses `1800 × 2050` even when the photograph has another size or orientation.
Four corners use a projective transform; three use an affine fallback.

### `normalizedImage(): Image`

Returns a snapshot of the rectified bitmap produced by the most recent
successful `normalize()` call. This is useful for a diagnostics page that lets
an operator verify orientation, cropping, marker alignment, QR placement, and
answer-grid alignment before grading.

```ts
const normalized = grader.normalizedImage();
try {
  if (normalized.width === 0 || normalized.height === 0) {
    throw new Error("No normalized image is available");
  }

  drawGrayImage(debugCanvas, normalized);
} finally {
  normalized.data.delete();
}
```

The returned `Image` owns a separate Wasm byte vector. Deleting
`normalized.data` does not clear the grader's internal normalized bitmap and
does not prevent later `detectRevisionId()` or `gradeSheet()` calls.

Before successful normalization, the method returns an empty image. A
successful canonical normalization returns a Gray `1800 × 2050` image.

### `detectRevisionId(): RevisionDetection | undefined`

```ts
const revision = grader.detectRevisionId();
if (!revision) throw new Error("Revision QR was not found");

try {
  const revisionId = Uint8Array.from(revision.revisionId);
  console.log(revisionId, revision.tl, revision.tr, revision.br, revision.bl);
} finally {
  revision.revisionId.delete();
}
```

Call after normalization. A successful result contains a 16-byte ID.

### `gradeSheet(cellSize, innerCellSize): Vector_Bytes`

For a sheet normalized to `1800 × 2050`:

```ts
const grades = grader.gradeSheet(
  { width: 84, height: 84 },
  { width: 42, height: 42 },
);
try {
  const answerMasks = Uint8Array.from(grades);
} finally {
  grades.delete();
}
```

For another logical normalization size, scale both dimensions consistently.
The result contains one byte per detected question in insertion order.

### Answer bitmasks

Answer index `i` maps to bit `i`:

| Index | Mask |
|---:|---:|
| 0 | `0b00000001` / `1` |
| 1 | `0b00000010` / `2` |
| 2 | `0b00000100` / `4` |
| 3 | `0b00001000` / `8` |
| 4 | `0b00010000` / `16` |
| 5 | `0b00100000` / `32` |
| 6 | `0b01000000` / `64` |
| 7 | `0b10000000` / `128` |

```ts
0b00000000 // blank
0b00000100 // third answer; C for A-D labels
0b00001001 // first and fourth answers; A and D
```

Marking the small inner square selects an answer. Marking the larger outer
correction region cancels it. If both are marked, correction wins. Labels do
not change bit positions; with `T` and `F`, T is bit 0 and F is bit 1.

## Global functions

### `generateQr(data, size): Image`

```ts
const payload = toWasmBytes(openOmr, new TextEncoder().encode("hello"));
let qr: Image | undefined;
try {
  qr = openOmr.generateQr(payload, { width: 240, height: 240 });
} finally {
  payload.delete();
  qr?.data.delete();
}
```

The grayscale result includes the required QR quiet zone. Empty data or a
non-positive size produces an empty image.

### `detectQrCode(image, hints?): Vector_QrDetection`

```ts
const detections = openOmr.detectQrCode(image, {
  x: 100, y: 100, width: 500, height: 500,
});
try {
  for (const detection of detections) {
    try {
      console.log(new TextDecoder().decode(
        Uint8Array.from(detection.data),
      ));
    } finally {
      detection.data.delete();
    }
  }
} finally {
  detections.delete();
}
```

The detector searches the clipped ROI first and falls back to the full image
if it gets no decoded result. Omit the second argument for a global search.

### `checkImageQuality(image): ImageQuality`

```ts
const quality = openOmr.checkImageQuality(image);
if (quality.value !== openOmr.ImageQuality.Good.value) {
  // ask the user to capture the sheet again
}
```

Results are `Good`, `TooDark`, and `TooBright`. This coarse exposure check does
not guarantee focus or marker visibility.

## Complete TypeScript workflow

```ts
import MainModuleFactory, {
  type Image,
  type MainModule,
  type Vector_Bytes,
} from "./openOmr.js";

const encode = (text: string) => new TextEncoder().encode(text);
const fromBytes = (value: Vector_Bytes) => Uint8Array.from(value);

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll("-", "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error("Invalid UUID");
  return Uint8Array.from(Array.from({ length: 16 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)));
}

const openOmr: MainModule = await MainModuleFactory();
const generator = new openOmr.SheetGenerator();
let sheet: Image | undefined;

try {
  const expectedId = uuidToBytes("10213243-5465-4787-98a9-bacbdcedfe0f");
  generator.initialize({ width: 1800, height: 2050 }, expectedId);

  if (!generator.addQuestion(1, 0, [
    encode("A"), encode("B"), encode("C"), encode("D"),
  ])) throw new Error("Question 1 was rejected");

  if (!generator.addQuestion(2, 1, [encode("T"), encode("F")])) {
    throw new Error("Question 2.1 was rejected");
  }

  sheet = generator.generate();
  if (sheet.width === 0) throw new Error("Generation failed");

  // Normally print/export `sheet`, then construct this image from a camera,
  // scanner, canvas, or decoded file. Here the pristine sheet is graded.
  const capturedImage = sheet;
  const grader = new openOmr.SheetGrader();
  try {
    const markers = grader.detectAruco(capturedImage);
    try {
      if (markers.size() < 4) throw new Error("Markers not found");
    } finally {
      markers.delete();
    }

    if (!grader.normalize({ width: 1800, height: 2050 })) {
      throw new Error("Normalization failed");
    }

    const normalized = grader.normalizedImage();
    try {
      // Optional diagnostics: drawGrayImage(debugCanvas, normalized);
      console.log(normalized.width, normalized.height);
    } finally {
      normalized.data.delete();
    }

    const revision = grader.detectRevisionId();
    if (!revision) throw new Error("Revision not found");
    try {
      const actualId = fromBytes(revision.revisionId);
      if (!actualId.every((value, index) => value === expectedId[index])) {
        throw new Error("Unexpected revision");
      }
    } finally {
      revision.revisionId.delete();
    }

    const grades = grader.gradeSheet(
      { width: 84, height: 84 },
      { width: 42, height: 42 },
    );
    try {
      console.log(fromBytes(grades));
    } finally {
      grades.delete();
    }
  } finally {
    grader.delete();
  }
} finally {
  sheet?.data.delete();
  generator.delete();
}
```

## Failure behavior

| Operation | Failure result |
|---|---|
| Invalid `initialize()` arguments | throws |
| Invalid `Image.data` length | throws |
| Invalid font | `setFont()` returns `false` |
| Invalid, duplicate, or overflowing question | `addQuestion()` returns `false` |
| Sheet rendering failure | empty `Image` |
| No ArUco markers | empty detection vector |
| Unresolved normalization | `normalize()` returns `false` |
| Missing/invalid revision QR | `detectRevisionId()` returns `undefined` |
| No readable rows | empty grading vector |

## API summary

```ts
export default function MainModuleFactory(
  options?: unknown,
): Promise<MainModule>;

interface SheetGenerator extends ClassHandle {
  initialize(size: Size, revisionId: Uint8Array): void;
  setFont(fontData: Uint8Array): boolean;
  addQuestion(
    questionNumber: number,
    subQuestionNumber: number,
    answerLabels: Uint8Array[],
  ): boolean;
  generate(): Image;
}

interface SheetGrader extends ClassHandle {
  detectAruco(image: Image): Vector_ArucoDetection;
  normalize(sheetOriginalSize: Size): boolean;
  normalizedImage(): Image;
  detectRevisionId(): RevisionDetection | undefined;
  gradeSheet(cellSize: Size, innerCellSize: Size): Vector_Bytes;
}

generateQr(data: Vector_Bytes, size: Size): Image;
detectQrCode(image: Image, hints?: View): Vector_QrDetection;
checkImageQuality(image: Image): ImageQuality;
```

`openOmr.d.ts` is the authoritative declaration of the distributed TypeScript
surface. This document supplies call order, semantic validation, image format,
grading, and ownership details that declarations cannot express.