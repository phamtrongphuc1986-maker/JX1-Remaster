#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${COCOS_CREATOR_CLI:?Set COCOS_CREATOR_CLI to the executable Cocos Creator 3.x CLI path}"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to the installed Android SDK directory}"
[[ -x "$COCOS_CREATOR_CLI" ]] || { echo "Cocos Creator CLI is not executable" >&2; exit 2; }
[[ -d "$ANDROID_SDK_ROOT" ]] || { echo "Android SDK directory does not exist" >&2; exit 2; }
[[ -f "$PROJECT_DIR/package.json" && -d "$PROJECT_DIR/assets" ]] || { echo "Cocos project files are missing" >&2; exit 2; }
[[ -f "$PROJECT_DIR/assets/scenes/Main.scene" ]] || { echo "Main.scene is missing; APK build intentionally blocked until the real Cocos scene is authored and tested." >&2; exit 3; }
mkdir -p "$PROJECT_DIR/build"
"$COCOS_CREATOR_CLI" --project "$PROJECT_DIR" --build "platform=android;debug=false"
APK="$(find "$PROJECT_DIR/build" -type f -name '*.apk' -print -quit)"
[[ -n "$APK" ]] || { echo "Creator CLI produced no APK" >&2; exit 4; }
mkdir -p "$PROJECT_DIR/release/apk"
cp "$APK" "$PROJECT_DIR/release/apk/JX1-Remaster-android.apk"
sha256sum "$PROJECT_DIR/release/apk/JX1-Remaster-android.apk"
