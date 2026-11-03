#!/usr/bin/env bash
# Builds the JAK Projects APK from the web build without Android Studio.
# Needs (Ubuntu): apt install aapt android-sdk-platform-23 apksigner zipalign dalvik-exchange
# Usage: android-shell/build.sh <keystore> <storepass>
set -euo pipefail
cd "$(dirname "$0")/.."
KS=${1:?keystore path}; PASS=${2:?keystore password}
SDK=/usr/lib/android-sdk; JAR=$SDK/platforms/android-23/android.jar
OUT=android-shell/build; rm -rf "$OUT"; mkdir -p "$OUT"/{gen,classes,stubs,apk/assets}

npx expo export --platform web --output-dir "$OUT/apk/assets/www" >/dev/null
# Only the icon font the app uses.
find "$OUT/apk/assets/www/assets/node_modules" -name '*.ttf' ! -name 'Ionicons*' -delete

aapt package -f -m -J "$OUT/gen" -M android-shell/AndroidManifest.xml -S android-shell/res -I "$JAR" \
  --min-sdk-version 23 --target-sdk-version 34
javac -nowarn -source 8 -target 8 -bootclasspath "$JAR" -d "$OUT/stubs" $(find android-shell/stubs -name '*.java') 2>/dev/null
javac -nowarn -source 8 -target 8 -bootclasspath "$JAR" -cp "$OUT/stubs" -d "$OUT/classes" \
  $(find android-shell/src "$OUT/gen" -name '*.java') 2>&1 | grep -v "^warning\|^Note\|bootstrap" || true
"$SDK/build-tools/debian/dx" --dex --output="$OUT/apk/classes.dex" "$OUT/classes"
aapt package -f -M android-shell/AndroidManifest.xml -S android-shell/res -I "$JAR" \
  --min-sdk-version 23 --target-sdk-version 34 --ignore-assets "!.svn:!.git:!.DS_Store:.*:*~" -A "$OUT/apk/assets" -F "$OUT/unsigned.apk"
(cd "$OUT/apk" && zip -q -r ../unsigned.apk classes.dex)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
apksigner sign --ks "$KS" --ks-pass "pass:$PASS" --out "$OUT/JAK-Projects.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/JAK-Projects.apk" && ls -la "$OUT/JAK-Projects.apk"
