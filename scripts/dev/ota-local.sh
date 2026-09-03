#!/usr/bin/env bash
# Local OTA test harness. Runs the whole Capacitor update loop on this machine
# and a USB-attached handset, with no GitHub Actions, no public release, and no
# production server involved.
#
#   ./scripts/dev/ota-local.sh serve      # run the update service on :8080
#   ./scripts/dev/ota-local.sh apk        # build + install a debug APK wired to it
#   ./scripts/dev/ota-local.sh publish    # build a web bundle and roll it out
#   ./scripts/dev/ota-local.sh check      # ask the service what a handset would get
#   ./scripts/dev/ota-local.sh reset      # clear local releases/channels/bundles
#
# Typical loop once `serve` and `apk` have run once: edit code, `publish`,
# cold-start the app twice. Under a minute per iteration.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE_DIR="${OTA_SERVICE_DIR:-$APP_DIR/../practocore-update-service}"
STATE_DIR="${OTA_STATE_DIR:-$APP_DIR/.ota-local}"
BUNDLE_DIR="$STATE_DIR/bundles"
PORT="${OTA_PORT:-8080}"
TOKEN="${OTA_ADMIN_TOKEN:-local-development-token}"
BASE="http://127.0.0.1:$PORT"
# The app talks to this backend. Point it at a local PocketBase to test fully
# offline, or leave it at production to exercise real data.
BACKEND="${OTA_BACKEND_URL:-https://api.practocore.com}"

die() { echo "error: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed"; }

case "${1:-}" in
serve)
  have go
  [ -d "$SERVICE_DIR" ] || die "update service not found at $SERVICE_DIR (set OTA_SERVICE_DIR)"
  mkdir -p "$BUNDLE_DIR"
  echo "update service      : $BASE"
  echo "bundles             : $BUNDLE_DIR"
  echo "state               : $STATE_DIR/updates.json"
  echo
  echo "Leave this running. In another terminal: $0 apk"
  cd "$SERVICE_DIR"
  UPDATE_SERVICE_ADMIN_TOKEN="$TOKEN" \
  UPDATE_SERVICE_DATA_PATH="$STATE_DIR/updates.json" \
  UPDATE_SERVICE_BUNDLE_PATH="$BUNDLE_DIR" \
  PORT="$PORT" \
    go run ./cmd/update-service
  ;;

apk)
  have adb
  have bun
  adb get-state >/dev/null 2>&1 || die "no device attached (check 'adb devices' and USB debugging)"
  # The handset's own loopback is forwarded to this machine, so the URL compiled
  # into the app is 127.0.0.1 — which capacitor.config.ts already allows over
  # http, and which the debug network security config permits.
  adb reverse tcp:$PORT tcp:$PORT
  echo "adb reverse         : device 127.0.0.1:$PORT -> this machine"

  cd "$APP_DIR"
  NUXT_PUBLIC_POCKETBASE_URL="$BACKEND" bun run generate
  PRACTOCORE_CAPACITOR_UPDATE_URL="$BASE/api/capacitor/updates" bunx cap sync android
  ( cd android && ./gradlew assembleDebug )
  adb install -r android/app/build/outputs/apk/debug/app-debug.apk
  echo
  echo "Installed. The app now checks $BASE/api/capacitor/updates"
  echo "Open it once so notifyAppReady() marks the builtin bundle healthy, then: $0 publish"
  ;;

publish)
  have bun; have curl; have zip
  VERSION="${2:-$(date +%Y%m%d-%H%M%S)}"
  mkdir -p "$BUNDLE_DIR"
  cd "$APP_DIR"
  NUXT_PUBLIC_POCKETBASE_URL="$BACKEND" bun run generate
  # index.html must sit at the archive root; a nested dist/ folder extracts to a
  # bundle the plugin cannot boot.
  ( cd dist && zip -qr "$BUNDLE_DIR/$VERSION.zip" . )
  SIZE=$(stat -c%s "$BUNDLE_DIR/$VERSION.zip")
  SHA=$(sha256sum "$BUNDLE_DIR/$VERSION.zip" | cut -d' ' -f1)
  NATIVE=$(node -p "require('$APP_DIR/package.json').version")

  # requiredCapabilities MUST stay empty: the Capacitor adapter builds its check
  # without capabilities, so any requirement here returns `blocked` on device.
  # Fail loudly. A duplicate release id is rejected ("release already exists"),
  # and the plugin compares bundle versions by string inequality — so reusing a
  # version name is a no-op that would otherwise look like a successful publish.
  api() {
    local method="$1" path="$2" body="$3" out code
    out=$(curl -sS -o /tmp/ota-local-response -w '%{http_code}' -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$body") || {
      die "cannot reach the update service at $BASE — is '$0 serve' running?"
    }
    code="$out"
    if [ "$code" -ge 300 ]; then
      die "$method $path returned $code: $(cat /tmp/ota-local-response)"
    fi
  }

  api POST /admin/releases "{\"id\":\"local-$VERSION\",\"appId\":\"com.practocore.app\",\"target\":\"web\",
         \"version\":\"$VERSION\",\"decision\":\"silent_web_update\",\"provider\":\"self-hosted\",
         \"providerConfig\":{\"bundleUrl\":\"$BASE/bundles/$VERSION.zip\"},
         \"minNativeVersion\":\"$NATIVE\",\"requiredCapabilities\":[],
         \"archiveSha256\":\"$SHA\",\"archiveSize\":$SIZE,\"notes\":\"local test bundle\"}"
  api PUT /admin/channels/production "{\"name\":\"production\",\"releaseId\":\"local-$VERSION\",\"rolloutPercent\":100,\"paused\":false}"

  echo "published $VERSION  ($(numfmt --to=iec "$SIZE"), sha256 ${SHA:0:12}…)"
  echo
  "$0" check "$NATIVE"
  echo
  echo "On the handset: fully close the app and reopen it (downloads), then close"
  echo "and reopen once more (activates — the 'kill' delay condition means a"
  echo "downloaded bundle never swaps in mid-session)."
  ;;

check)
  have curl
  NATIVE="${2:-$(node -p "require('$APP_DIR/package.json').version")}"
  echo "what a handset on native $NATIVE would be told:"
  curl -sS -X POST "$BASE/api/capacitor/updates" -H 'Content-Type: application/json' \
    -d "{\"app_id\":\"com.practocore.app\",\"custom_id\":\"\",\"defaultChannel\":\"production\",
         \"device_id\":\"local-harness\",\"install_source\":\"\",\"is_emulator\":false,
         \"is_prod\":true,\"key_id\":\"\",\"platform\":\"android\",\"plugin_version\":\"8.51.15\",
         \"version_build\":\"$NATIVE\",\"version_code\":\"1\",\"version_name\":\"builtin\",
         \"version_os\":\"14\"}"
  echo
  ;;

reset)
  rm -rf "$STATE_DIR"
  echo "cleared $STATE_DIR — restart 'serve' for a clean control plane"
  ;;

*)
  awk 'NR>1 && /^#/ {sub(/^# ?/,""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"
  exit 1
  ;;
esac
