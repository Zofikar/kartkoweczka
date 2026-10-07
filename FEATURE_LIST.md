# MVP 1.0 Features

Status reflects the implementation inspected on October 7, 2026. Checked items mean
implemented in the repository, not certified on every browser or native device.

- [x] Polish and English UI with persisted language selection.
- [x] Shared responsive desktop/mobile UI, installable PWA and Tauri frontend.
- [x] Create, edit and delete tests.
- [x] Question bank with single-choice and true/false questions, correct answers, tags,
      images and rich text/math editing.
- [x] Persist tests locally (browser SQLite WASM/OPFS; native SQLite in Tauri).
- [x] Printable A4 test preview and system/browser printing, including save-to-PDF where supported.
- [x] Printable answer sheets with OMR markers and revision metadata QR.
- [x] Identify a locally stored test revision from an answer sheet QR.
- [x] Generate and save revisions with optional randomized question and answer ordering.
- [x] Transfer tests and revisions offline using JSON or MessagePack file export/import.
- [x] Scan answer sheets from image uploads or camera frames and calculate correct-answer
      counts and percentages against the saved revision.

## Additional implemented functionality

- Direct P2P transfer using a short-lived room code (Trystero/WebRTC); this is not a
  guaranteed offline transport and requires network signaling.
- Development-only OMR diagnostics at `#/debug/grading-sheet`.
- Git-tag-derived versions, native release workflows, Pages deployment and native update UI.

## Limitations and remaining validation

- Multiple-choice/checkbox questions, configurable grade scales, weighted scoring and
  manual answer entry are not implemented in the production scanner UI.
- PDF output uses printing; there is no dedicated PDF generation library.
- A QR stores revision metadata, not the answer key. Import the corresponding test and
  revision before scanning on another device.
- Revisions store ordered snapshots but remain editable. Editing a printed revision can
  change the key used to grade existing sheets; retain its printed contents when grading.
- PWA storage is not guaranteed permanent: browsers may deny persistence and evict data.
  Keep copies on a native installation or regularly export every test.
- Import/export is test-wide, one test at a time, without conflict handling; incoming
  data is treated as authoritative. There is no single-file full backup.
- Live camera handling can be unreliable depending on the device. Taking a photo with
  all markers visible in the system camera app and uploading it from the gallery is a fallback.
- Native installation/update behavior and camera accuracy require target-device testing.
  Linux release jobs are currently disabled; implementation is not a support guarantee.
