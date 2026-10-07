# Development and architecture

[Back to the user guide](README.md)

This document covers implementation, local development, validation and releases.
For installation and everyday use, see the README.

## Architecture

Kartkóweczka is a local-first Svelte 5 and TypeScript application built with Vite.
The same UI is delivered through two distinct environments:

|                | Web / PWA                                          | Native / Tauri                                  |
| -------------- | -------------------------------------------------- | ----------------------------------------------- |
| Installation   | Browser installation / Add to Home Screen          | Downloaded installer or APK                     |
| Offline assets | PWA service worker cache                           | Assets bundled with the application             |
| Database       | SQLite WASM in a worker, persisted in browser OPFS | Rust/rusqlite in the application data directory |
| Updates        | PWA service worker                                 | Native update UI and platform installation flow |

Drizzle's SQLite proxy and repositories in `src/db/repositories` provide the shared
persistence interface. Browser database ownership is coordinated across tabs using
Web Locks and BroadcastChannel. Native database calls use a mutex-protected connection.
`DATABASE_BACKEND` selects the backend at build time; native builds exclude browser
SQLite/OPFS code and disable the PWA service worker.

- `src/pages` contains question, test, revision and scanner screens.
- `src/lib/components` contains editors, print sheets, transfer dialogs and installation UI.
- `src/router.ts` uses hash-based routing for portable static and native deployment.
- `lang/en.json` and `lang/pl.json` provide offline, typed localization.
- `openOmr` contains the C++/OpenCV implementation; `src/wasm` contains its bundled artifacts.
- `src/utils/transfer.ts` validates JSON/MessagePack transfers; `roomTransfer.ts` handles
  optional Trystero/WebRTC rooms.

### Data and privacy boundaries

Questions, tests and revisions are persisted locally, not in an application-hosted cloud
database. There are no user accounts or automatic cloud synchronization. Browser and
native installations have separate storage; export/import is required to move tests.

Offline-first does not mean every operation avoids network access: initial web loading,
downloads, release checks and optional P2P signaling use network services. P2P explicitly
shares the selected test with another device. File export/import is the offline alternative.
Clearing site data or uninstalling the app may remove local data, so users need exports
as backups. PWA installation does not guarantee persistence: browsers may deny persistent
storage and evict unprotected origin data. Keep all tests on at least one native installation
or export every test regularly. Native storage avoids browser eviction, not device loss.

Transfer is test-wide, one test at a time, with no conflict-resolution UI; incoming data is
treated as authoritative. There is no single-file full-database backup. Live camera handling
is device-dependent; gallery upload of a photo containing all markers is the fallback.

Revision snapshots preserve ordered questions and answers, but they remain editable.
A printed sheet identifies a revision rather than carrying its answer key; grading requires
that revision locally and its contents should remain consistent with the printed sheet.

## Development setup

Use Node.js 24 (as in CI) and Yarn 4.18.0. From the cloned repository directory:

```bash
corepack enable
yarn install --immutable

# Start the development server
yarn dev

# Build and preview the production app
yarn build
yarn preview
```

Vite prints the local server address when it starts. Camera access requires permission and
a secure context (HTTPS or localhost). Development bypasses the PWA installation gate;
the production web app displays an installation screen. Optional configuration is described
in `.env.example`. Do not publish your local `.env` or secrets. `VITE_APP_ID` must match
on devices joining the same P2P room.

### Validation and documentation

```bash
yarn check        # Svelte and TypeScript
yarn lint         # Prettier and ESLint
yarn test:version # Short versioning test suite used in CI
yarn test:scripts # All script tests; some require additional tools
yarn db:generate # Generate migrations after schema changes
```

The schema and repositories live in `src/db`. Drizzle ORM uses a shared interface to the
browser or Tauri backend. OMR uses bundled C++/OpenCV WebAssembly artifacts.

- `FEATURE_LIST.md` — implemented MVP features and limitations.
- `src/db/TAURI_BRIDGE.md` — database backends and bridge contract.
- `docker/README.md` — optional containerized Android checks.
- `openOmr/WASM_API.md` — source OMR API documentation.
- `src/wasm/WASM_API.md` — documentation distributed with the WASM artifacts.

Build OMR with `python openOmr/build.py wasm`, or build and test it with
`python openOmr/build.py wasm-test` (Python and Docker required). The build synchronizes
artifacts into `src/wasm`; do not manually edit generated JS, WASM or type declarations.

### Native app (Tauri)

Rust and the platform-specific Tauri system dependencies are required.

```bash
yarn tauri:dev
yarn tauri:build
```

Tauri builds select the native database backend automatically. Rust stores SQLite data in
`kartkoweczka.sqlite3` in the app data directory. Browser OPFS and SQLite WASM are excluded
from the native frontend bundle.

### PWA deployment to GitHub Pages

`pages.yml` publishes the browser app after a successful **Native release** workflow.
It can also be run manually for a branch, tag or commit. An empty `ref` uses the branch
selected in the workflow form without rebuilding installers.

In Settings → Pages, select **GitHub Actions** as the source. The Pages workflow must be
on the default branch, and the `github-pages` environment must allow deployment from the
selected branches and tags.

The build uses the browser backend, generates the service worker and PWA manifest, sets
the base path from Pages configuration and adds `404.html` for SPA fallback. The site URL
appears in the deployment summary and Settings → Pages.

### Git-derived versioning

Stable Git tags (`vX.Y.Z`) are the sole version source. `yarn version:describe` reports the
version resolved by `git describe`, commit SHA and working-tree state. Web builds expose
these through `version.json`, `__APP_VERSION__` and `__APP_COMMIT__`. Commits after a tag
add distance and hash information; local modifications add `-dirty`.

Run **Version bump** on `main` in GitHub Actions and select `patch`, `minor` or `major`.
The default `dry_run` only validates and previews the result. Disable it to create an
annotated tag and dispatch **Native release**. No version-bump commit is created.
Validation runs the short `yarn test:version` suite (two-minute limit), lint and type checks,
not Docker, emulator or native builds. Repository rules must allow the workflow token to
create tags and dispatch workflows. If a tag was pushed but dispatch failed, rerun
**Native release** for that tag; do not bump again or move published tags.

The Cargo/Tauri `0.0.0` version fields are required placeholders. Use `yarn tauri`,
`yarn tauri:dev` and `yarn tauri:build`: the wrapper stamps the Git version, passes it to
the frontend and restores configuration on exit. Without `.git`, development builds use
`0.0.1-dev` (Android requires a nonzero version). Official releases require a clean checkout
at the exact tag. Android version codes use `major * 1000000 + minor * 1000 + patch`,
with minor and patch limited to 999.

Docker deliberately excludes `.git`. Pass host metadata before a local Android build:

```powershell
$env:BUILD_VERSION_JSON = node scripts/version.mjs
yarn test:docker:android
```

### Installer pipeline and updates

`release.yml` currently builds Windows x64 (NSIS) and Android ARM64 (APK). Linux x64 and
ARM64 builds (AppImage and `.deb`) are temporarily disabled to save Actions time. The
workflow runs on stable tag pushes or manually for an existing tag. Publishing happens
only after all enabled builds succeed.

The configured Linux builds use Debian 12 containers on Ubuntu 24.04 runners to avoid
requiring the host's newer glibc. Debian packages target Debian 12 and Ubuntu 24.04; both
architectures need installation tests before full support can be claimed. The web UI offers
AppImage and a separate `.deb` link; the updater selects the installed package format.
The manifest retains `downloads` links and adds package variants in `packages`.

Before the first release, configure:

- The updater public key in `src-tauri/tauri.conf.json`.
- GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Android secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_PASSWORD` and `ANDROID_KEY_ALIAS`.

Generate updater keys locally with `yarn tauri signer generate -w <key-path>`. Use the full
contents of the appropriate files in configuration and secrets. Keep private keys and
keystores outside the repository. Android releases must retain the same signing key.

The generated `version_mainfest.json` contains download links and signed Tauri updater
artifacts in `platforms`. The spelling `mainfest` is intentional. The web UI fetches the
same JSON from the latest release description through the GitHub API, detects the platform
and allows manual selection. If no suitable release exists, PWA installation remains
available. The file in `public` is an initial example, not the source of current releases.

Desktop supports update checks and separate installation confirmation with restart.
Android downloads and validates APKs through a native plugin; the user approves installation
in the system UI. Manual APK installation is also possible. Updater signatures do not
replace Windows Authenticode. The full pipeline still needs GitHub runner validation and
installation/update tests on target devices.

### License reports (FOSSA)

The manually triggered `update-license.yml` requires `FOSSA_API_KEY` with permission to
analyze the project and retrieve reports. It analyzes Yarn and Rust dependencies, then
creates a PR updating `LICENSES.md` and `public/licenses.html`. Failed analysis stops report
generation; FOSSA policy results do not block license information retrieval.

Compiled OMR dependencies are declared in `fossa-deps.yml`. When changing OpenCV,
OpenCV contrib, FreeType or HarfBuzz versions in `openOmr/docker/Dockerfile`, also update
the versions and archive URLs in that file.
