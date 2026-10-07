# Containerized native checks

Run from the repository root with Docker Compose v2. Source is copied into the
image, not mounted: tests cannot modify the host checkout. Rebuild after changes.
Local secrets, generated projects, and signing keystores are excluded from the
build context. No production signing credentials are needed.

## Policy and script tests

```sh
yarn test:docker
```

Runs all script tests, including compiled JVM tests of the production Android
update policy. This does not perform Android APK signature verification.

## Android compilation

```sh
yarn test:docker:android
```

Compiles the actual Rust bridge and Kotlin plugin into a debug-signed ARM64 APK.
The APK is stored at `/artifacts/application-debug.apk` in the Compose artifacts
volume. This deliberately uses a disposable debug key, never the release key.
The Android images require an x86-64 Linux container runtime.

## Optional emulator profile

```sh
yarn test:docker:emulator
```

Requires an x86-64 Linux Docker host with accessible `/dev/kvm` and hardware
virtualization enabled. Docker Desktop on Windows/macOS is not assumed to expose
KVM. The profile maps only the KVM device; it does not require privileged mode.
Android SDK packages require acceptance of Google's SDK licenses during build.
Allow substantial disk space and memory for SDK/NDK downloads and the emulator.

Builds an x86-64 debug APK, boots an API 35 emulator with bounded waits, installs
the APK, launches the app, and confirms its process remains alive after ten
seconds. Emulator output, logcat, launch results, and APK are kept in the artifacts
volume even after the test container exits. To copy results:

```sh
docker compose -f docker/compose.yml run --rm --no-deps -v ./docker/artifacts:/export --entrypoint bash android-build -c 'cp -r /artifacts/. /export/'
```

## Automatic cleanup and retained results

All test shortcuts use `run --rm`: test containers are automatically removed
when they exit, including on test failure. No separate cleanup command is needed
after a normal run. Files inside those containers disappear with them.

The artifacts volume intentionally survives so APKs and failure diagnostics can
be inspected. Images and build cache also remain to speed up subsequent runs.
The Compose network may remain; it does not run a background service.

To explicitly delete retained artifacts and the Compose network (not required
after tests):

```sh
yarn test:docker:purge
```

## Coverage boundaries

Use `yarn test:docker:config` to validate all Compose profiles without building or
starting containers. The shortcuts are defined in `package.json` and appear in
VS Code's NPM Scripts panel. Purge deletes the retained artifacts volume, not
Docker images or the build cache. Do not run purge while tests are running.

The emulator job is a build/install/launch smoke test, **not yet an end-to-end
updater test**. It does not approve system installer dialogs, install a second
version, test data preservation, or serve controlled update responses. Production
GitHub URL restrictions remain unchanged; no insecure test endpoint was added.
Windows NSIS and McAfee tests still require a Windows runner/VM, not these Linux
containers. No fixture-server container is included until tests consume it.
