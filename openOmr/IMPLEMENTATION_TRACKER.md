# openOmr API Completion Tracker

This document is the implementation tracker for completing the native and
WebAssembly behavior declared by `wasm/api.yaml`.

## Contract decisions

- The public JavaScript/WebAssembly API remains defined by `wasm/api.yaml`.
- Sheet versions are an internal native concern; production generation uses
  the latest version (`64`).
- Native tests may explicitly generate any version from `1` through `64`.
- Versions without custom geometry inherit the latest version's geometry.
- Corner marker IDs are `3`, `5`, `25`, and `26`; fixed-bottom (`FB`) is `31`.
- Detection uses a compact dictionary containing only those five retained
  `DICT_4X4_50` codewords. Distinct IDs have minimum Hamming distance 7, but
  the minimum between orientation codewords of the same ID is 6. Following
  OpenCV's dictionary-distance definition, self-rotations are excluded, so
  `maxCorrectionBits` is 3. Public detections retain the original canonical
  IDs rather than exposing compact row IDs 0-4.
- Canonical marker rotations are TL=90, TR=0, BR=180, BL=0, FB=0 degrees.
- Sheet identity is a 16-byte UUIDv4/v7 revisionId and must round-trip unchanged.
- A question supports one through eight caller-defined labels of one to three
  uppercase A-Z characters (for example A-D or T/F).
- `gradeSheet()` returns one byte per question in question insertion order;
  answer positions 0-7 map to bits 0-7 regardless of their display labels.
- Marking the small inner square selects an answer. Marking the large outer
  correction region cancels that answer, including when both are marked.

## Sheet landmarks

```text
TL                                  TR

                         QR

BL   FB                             BR

  1   [A]  [B]  [C]  [D]
  2   [T]  [F]
```

The current layout also enforces these geometric rules:

- Four equal L-shaped corner guides define the usable sheet boundary.
- A single `quietZone` value controls guide-to-ArUco padding, BL-to-FB
  separation, and BR-to-QR separation.
- The QR occupies a dedicated bottom band: it keeps one quiet zone from the
  physical bottom edge and one quiet zone from BR's left edge.
- The answer area is one contiguous table; cells share borders and include a
  question-number column. There is no separate answer-header row.
- Inner answer squares are derived from `innerSquareRatio * cellSize` and use
  a versioned 4-unit (0.4 mm / 1.13 pt) reference stroke. After flat A5
  scaling this remains approximately 0.283 mm / 2.23 dots at 200 DPI.
- `maxQuestionCount(config, maxAnswerCount)` derives row capacity from the
  configured grid rectangle and validates horizontal answer capacity.
- The physical grid uses 8.4×8.4 mm cells and 4.2×4.2 mm inner squares. Each
  question column holds 18 rows. Ordered overflow continues top-to-bottom in
  another column, and each column is only as wide as its own maximum answer
  count. The bottom QR band frees a 166 mm-wide grid, so uniform four-answer
  sheets support 54 questions and uniform eight-answer sheets support 36,
  while mixed widths can fit combinations such
  as one six-answer column plus one four-answer column.
- A5 robustness is built into the A4 master: 12 mm ArUco markers, a 26.4 mm QR,
  4 mm answer targets, and 0.4 mm critical strokes remain materially larger
  after ISO 70.71% flat scaling.
- Marker rectangles are required to be disjoint from the full configured grid
  area, preventing bottom fiducials from overlapping late question rows.
- Every row spans the full active answer width; unavailable answers omit the
  inner square, which is also the grader's validity signal.
- `SheetGenerator.setFont(fontData)` accepts caller-supplied TTF/TTC/OTF bytes,
  validates and copies them, and renders them portably through vendored
  `stb_truetype` in native and Wasm builds. This permits exact Arial rendering
  without copying or redistributing Microsoft's font. Empty input restores the
  deterministic Hershey Simplex fallback. Each caller-provided
  label is box-fitted at the largest size that preserves an inset inside its
  4 mm writable target. Sizing reserves font baseline space to keep printed
  ink safely below the mark threshold, while positioning centers only the
  visible uppercase cap-height box. Grading requires at least 50% fill,
  leaving the preprinted glyph below the marked threshold.
- Font input is size-bounded (12 bytes through 32 MiB) before parsing. As with
  other native font rasterizers, applications should supply trusted font files
  rather than arbitrary untrusted uploads.
- Question identifiers use a two-unit stroke and are box-fitted with a capped
  scale, keeping them only modestly larger than answer letters; longer
  identifiers still shrink automatically to fit their number cell.
- `python build.py preview` mounts `C:\Windows\Fonts\arial.ttf` read-only when
  available and passes it to the preview process; the font is never copied into
  the source tree or build artifact. Browser callers use
  `generator.setFont(new Uint8Array(await fontResponse.arrayBuffer()))` and are
  responsible for the supplied font's license.

## Work tracker

- [x] Analyze `api.yaml`, current core/Wasm code, `pawelimpl.py`, and
  `testing.py`.
- [x] Record API, sheet-layout, versioning, and grading decisions.
- [x] Implement the native marker version codec and semantic positioner.
- [x] Add exhaustive native marker/version unit tests.
- [x] Add versioned sheet geometry/configuration (undefined versions inherit
  version 64).
- [x] Implement `SheetGenerator`, QR placement, markers, and nested-square
  answer grid.
- [x] Implement ArUco image detection and perspective normalization.
- [x] Implement normalized compact revisionId QR detection.
- [x] Implement small-answer/big-correction classification and grading flags.
- [x] Finish global QR and image-quality APIs.
- [x] Repair Wasm generator and all native/Wasm conversions.
- [x] Add deterministic randomized native E2E tests for versions 1-64.
- [x] Regenerate bindings and pass the Wasm build.

## Native test strategy

### Unit tests

- Exhaust all 64 marker encodings and checksum recovery with any one corner
  missing.
- Port the `testing.py` role-resolution model, including arbitrary input order,
  page rotations, and one missing landmark.
- Test nested cells independently: blank, small-only, big-only, and both.
- Validate generator dimensions, marker identities/rotations, revisionId, and
  question capacity.

### End-to-end tests

- Use a native-only version selector while production always generates v64.
- Deterministically randomize questions, answer flags, corrections, revisionId,
  perspective/affine geometry, page rotation, and a missing marker.
- Run the real detect -> normalize -> QR -> grade workflow.
- Verify exact version, revisionId, normalized orientation, and answer bytes.
- Print the seed, version, missing landmark, and answer masks on failure.

## Verification

- `python build.py test`: **passed** — 5/5 suites, including both E2E suites
  and the seeded all-64-version randomized workflow.
- `python build.py wasm-test`: builds the Wasm module and runs a Node runtime
  smoke test across global functions, byte/vector/value/enum/optional
  conversions, generator and grader classes, ArUco detection, normalization,
  revision UUID round-trip, grading, and explicit Embind handle deletion.
- `WASM_API.md` documents module loading, public types and methods, byte-vector
  conversion, ownership/deletion, browser image conversion, generation and
  grading semantics, error behavior, and a complete TypeScript workflow.
- The Wasm `SheetGrader.normalizedImage()` accessor returns an owned image
  snapshot for consumer diagnostics after normalization.
- ArUco detection evaluates protocol-valid four/five-landmark subsets and
  scores page coverage plus projected marker-area consistency, preventing a
  filled answer target that resembles a dictionary codeword from invalidating
  normalization. The full-workflow suite injects a deterministic sixth raw
  marker in the answer grid and verifies that only the five sheet landmarks
  are retained.
- The working directory is not backed by a `.git` repository in this
  environment, so a final Git diff/status report was not available.

## Visual preview

Run `python build.py preview` to generate `sheet-preview.bmp` in the project
root. The preview uses the production/latest sheet version and demonstrates 40
questions split into a six-answer first column and two independently optimized
four-answer columns (18 + 18 + 4 questions). BMP output is written directly,
so preview generation does not require OpenCV's optional `imgcodecs` module.
Its 1800×2050 canvas and 10,000 px/m metadata represent the web geometry's
180×205 mm print block exactly: one canonical unit/pixel equals 0.1 mm.

## Current implementation notes

- `core/include/openOmr/marker_positioner.h` contains the pure domain API.
- `core/src/marker_positioner.cpp` ports the marker/version behavior from
  `pawelimpl.py` without using assertions for runtime validation.
- `tests/test_marker_positioner.cpp` exhausts versions and missing-marker
  recovery independently of OpenCV image detection.
- The root build enables CTest so `build.py test` discovers tests registered by
  the `tests` subdirectory.
- `core/include/openOmr/sheet_config.h` defines versioned geometry; all current
  versions intentionally inherit v64 geometry while retaining distinct marker
  encodings.
- `SheetGenerator::initialize()` uses v64 and the native-only
  `initializeForVersion()` enables exhaustive version testing without changing
  `wasm/api.yaml`.
- `SheetGrader` stores a detected source image, resolves semantic landmarks and
  version, normalizes projectively from four corners or affinely from three
  corners, detects the compact revisionId QR in its configured ROI, and classifies nested
  answer/correction regions. FB is not used as a homography corner because it
  is collinear with BL and BR.
- QR generation adds the required four-module quiet zone; QR detection ignores
  geometric candidates that fail payload decoding instead of returning an
  empty metadata value.
- `checkImageQuality()` classifies grayscale/RGB/RGBA input using mean
  brightness and clipped-pixel ratios; QR/quality behavior has focused native
  unit coverage.
- `tests/test_full_workflow.cpp` performs the native generated-sheet workflow
  for every version and verifies revisionId plus small-answer/big-correction
  precedence. It also performs an explicit 25-question/four-answer generation,
  detection, normalization, QR, and exact grading workflow.
- A dedicated 40-question workflow verifies self-described three-column
  grading: questions 1-18 form a six-answer block due to question 6, while
  questions 19-36 and 37-40 form independently optimized four-answer blocks.
- A flat-A5 simulation downsamples that marked 40-question sheet to 1002×1141
  pixels (the 180×205 mm block at ISO 70.71% and 200 DPI), then verifies all
  five ArUco markers, version, normalization, QR payload, and exact grading.
- Generated wrappers own the YAML-declared native C++ classes and call through
  `unique_ptr` correctly. Explicit conversions validate image byte sizes and
  bridge sizes, views, revision IDs, detections, enums, arrays, and optionals.
- The Wasm `addQuestion` contract accepts `Uint8Array[]`, allowing callers to
  pass labels such as `[encode("A"), encode("B")]` or `[encode("T"),
  encode("F")]` with `TextEncoder`. A Node smoke test exercises this exact
  boundary after every relevant build change.
- `tests/test_randomized_workflow.cpp` uses reproducible seed `0x5EED2026` and
  exercises every version with random answer/correction masks, one missing
  landmark, and 0/90/180/270-degree page rotations. Perspective cases omit FB
  while retaining four corners; corner-missing cases use recoverable randomized
  affine geometry.
- `SheetVersionConfig` is the single source of truth for guide, quiet-zone,
  marker, QR, grid, and proportional inner-square geometry. The contiguous
  grid grader detects rows from shared horizontal edges and valid answers from
  inner-square frames, so outlined but unavailable cells are ignored.
