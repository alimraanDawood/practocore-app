# Testing updates locally

The public release pipeline takes ~14 minutes and publishes to real users, which
makes it the wrong tool for finding out why something does not work on a
handset. This harness runs the entire Capacitor update loop on a development
machine and a USB-attached phone: no GitHub Actions, no public release, no
production server, and nothing that can reach a customer.

    ./scripts/dev/ota-local.sh serve      # terminal 1: the update service
    ./scripts/dev/ota-local.sh apk        # terminal 2: build + install a debug APK
    ./scripts/dev/ota-local.sh publish    # roll out a web bundle
    ./scripts/dev/ota-local.sh check      # what would a handset be told right now?
    ./scripts/dev/ota-local.sh reset      # wipe local releases, channels, bundles

After the one-time `serve` and `apk`, the loop is: edit code → `publish` →
cold-start the app twice. Under a minute.

## How the handset reaches your machine

`adb reverse tcp:8080 tcp:8080` maps the phone's own `127.0.0.1:8080` onto the
development machine. That choice matters for two reasons:

- `capacitor.config.ts` refuses a non-HTTPS update URL unless the host is
  `localhost` or `127.0.0.1`. Loopback satisfies the existing guard, so no
  production safety check has to be relaxed for testing.
- Android 9+ blocks cleartext traffic. `android/app/src/debug/` carries a
  network security config permitting it for loopback only. It lives in the
  `debug` source set, so the manifest merger cannot apply it to a release build,
  and `bun run release:verify` still asserts that releases permit no cleartext.

Nothing routable from your LAN is exposed. Unplug the cable and the phone can no
longer reach the service.

## Two cold starts, not one

`services/capacitor-updates.ts` stages a downloaded bundle with a `kill` delay
condition, so it never swaps in mid-session:

1. First cold start — the plugin checks, downloads, and stages the bundle.
2. Second cold start — the staged bundle becomes active.

"Cold start" means fully closing the app from the recents switcher. Backgrounding
is not enough, and this is deliberate: an update must never replace the frontend
while someone is editing a matter.

## Reading what happened

The service logs every request. On the device, attach Chrome DevTools through
`chrome://inspect/#devices` and watch the console — the plugin logs its checks,
downloads and failures there, and `services/capacitor-updates.ts` mirrors state
into the Settings → Application updates panel.

`adb logcat | grep -i capacitor` shows the same from the native side, including
messages the WebView console never sees.

## Traps that produce a silent "no update"

- `requiredCapabilities` must be `[]`. The Capacitor adapter builds its
  compatibility check without capabilities, so any requirement makes every
  device `blocked`. The harness always sends an empty list.
- `decision` must be `silent_web_update`, `prompt_restart`, or `rollback`.
  Anything else returns `blocked` with no bundle URL.
- `minNativeVersion` above the installed APK's version returns
  `require_native_update`. The harness reads the version from `package.json`, so
  rebuild the APK after a version bump or the phone drops out of range.
- `index.html` must be at the archive root. A nested `dist/` directory extracts
  to a bundle the plugin cannot boot.

## What this harness does not cover

Bundle signature verification, because none exists yet. The self-hosted lane
downloads an unsigned ZIP over HTTPS in production, which is why
`self-hosted-capacitor-ota.yml` offers no `production` target. Testing locally
does not change that gate; see `docs/self-hosted-capacitor-updates.md`.
