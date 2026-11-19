#!/usr/bin/env bash
set -euo pipefail
: "${ANDROID_HOME:?Define ANDROID_HOME con el SDK de Android}"
: "${APK_KEYSTORE:?Indica la ruta al almacén de firma}"
: "${APK_KEY_PASSWORD:?Define la contraseña del almacén de firma}"
export APK_KEY_PASSWORD

root=$(cd "$(dirname "$0")/.." && pwd)
tools="$ANDROID_HOME/build-tools/35.0.0"
platform="$ANDROID_HOME/platforms/android-35/android.jar"
output=${1:-"$PWD/Emprendiendo-en-Pareja.apk"}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/res/drawable" "$work/classes" "$work/dex"
cp "$root/public/assets/icon-192.png" "$work/res/drawable/logo.png"
"$tools/aapt2" compile --dir "$work/res" -o "$work/resources.zip"
"$tools/aapt2" link -I "$platform" --manifest "$root/android/AndroidManifest.xml" \
  -o "$work/unsigned.apk" "$work/resources.zip"
javac -source 8 -target 8 -classpath "$platform" -d "$work/classes" \
  "$root/android/src/mx/emprendiendoenpareja/app/MainActivity.java"
jar cf "$work/classes.jar" -C "$work/classes" .
"$tools/d8" --min-api 24 --lib "$platform" --output "$work/dex" "$work/classes.jar"
(cd "$work/dex" && zip -q "$work/unsigned.apk" classes.dex)
"$tools/zipalign" -f 4 "$work/unsigned.apk" "$work/aligned.apk"
"$tools/apksigner" sign --ks "$APK_KEYSTORE" --ks-key-alias pareja \
  --ks-pass env:APK_KEY_PASSWORD --out "$output" "$work/aligned.apk"
"$tools/apksigner" verify --verbose --print-certs "$output"
