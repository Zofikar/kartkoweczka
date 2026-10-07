#!/usr/bin/env bash
set -euo pipefail
test -r /dev/kvm && test -w /dev/kvm || { echo 'Readable/writable /dev/kvm is required on the Docker host.' >&2; exit 1; }
export ANDROID_TARGET=x86_64
bash /workspace/docker/android-build.sh
emulator -avd updater-test -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel on > /artifacts/emulator.log 2>&1 &
emulator_pid=$!
trap 'adb logcat -d > /artifacts/logcat.txt 2>&1 || true; kill "$emulator_pid" 2>/dev/null || true' EXIT
timeout 300 adb wait-for-device
booted=false
for attempt in $(seq 1 180); do
  if [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; then booted=true; break; fi
  kill -0 "$emulator_pid" || { cat /artifacts/emulator.log; exit 1; }
  sleep 2
done
$booted || { echo 'Emulator boot timed out' >&2; exit 1; }
adb install -r /artifacts/application-debug.apk
package=$(node -p 'JSON.parse(require("fs").readFileSync("/workspace/src-tauri/tauri.conf.json", "utf8")).identifier')
adb shell am start -W -n "$package/.MainActivity" | tee /artifacts/launch.txt
sleep 10
adb shell pidof "$package" > /artifacts/app-pid.txt
echo 'Android build, APK installation, and launch smoke test passed.'