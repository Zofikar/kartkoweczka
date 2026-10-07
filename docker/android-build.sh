#!/usr/bin/env bash
set -euo pipefail
cd /workspace
yarn tauri:android:init
yarn tauri android build --target "${ANDROID_TARGET:-aarch64}" --apk --debug
mkdir -p /artifacts
apk=$(find src-tauri/gen/android/app/build/outputs/apk -name '*debug.apk' -print -quit)
test -n "$apk"
cp "$apk" /artifacts/application-debug.apk