# Tauri frontend OTA proof of concept

This is a gated Phase 4 proof of concept. The official Tauri binary updater
remains the supported desktop update path. The frontend OTA plugin is pinned to
`tauri-plugin-hot-update` source revision
`84f6ba5f18535b78bae33454f6007d35dcdf4ab1` and ships disabled by default.

## Trust boundary

The plugin serves a signed archive only on the next cold launch and falls back
to the embedded assets if the app shell does not acknowledge readiness. Its
manifest URL and dedicated minisign public key are emitted into the signed
native release configuration by `create-tauri-updater-config.mjs`; frontend JS
cannot provide either value. Do not reuse `TAURI_UPDATER_PUBLIC_KEY` or its
private key for this channel.

To build an approved internal/beta trial, set all of these protected CI secrets:

- `TAURI_HOT_UPDATE_ENABLED=true`
- `TAURI_HOT_UPDATE_MANIFEST_URL=https://updates.practocore.com/desktop/<channel>/manifest.json`
- `TAURI_HOT_UPDATE_PUBLIC_KEY` (one or more comma-separated minisign public keys)
- `TAURI_HOT_UPDATE_PRIVATE_KEY` and optional `HOT_UPDATE_KEY_PASSWORD` only in
  the dedicated publishing environment.

The current release workflow always produces `{ "enabled": false }` until an
architecture decision changes it. Do not enable production channels from a
workflow input.

The native plugin is additionally excluded from ordinary builds. A POC build
requires `PRACTOCORE_ENABLE_HOT_UPDATE_POC=true` at compile time as well as an
enabled, signed hot-update configuration. This prevents a pre-1.0 asset-provider
plugin from affecting routine development or release builds.

## Required gates before enabling

- Clean-machine Windows, macOS arm64/x64, and Linux tests: no update, staged
  update, offline boot, interrupted download/extraction, full disk, and forced
  process exit.
- Verify PocketBase authentication, cookies, localStorage, IndexedDB, CSP,
  deep links, media permissions, and custom protocol behavior retain their
  existing origin.
- Test bad/minisign signatures, hash/size mismatch, archive traversal and
  expansion limits, replay/downgrade refusal, key rotation, rollback after no
  `notifyAppReady`, and the embedded-assets fallback.
- Record source/dependency review, named maintainer, response SLA, and fork
  plan. If upstream maintenance becomes unacceptable, leave this disabled and
  continue with the official binary updater.

## Operational sequence

1. Publish a reviewed web release record in the standalone update service.
2. Generate and sign the same approved web manifest using the dedicated key.
3. Enable only an internal channel in a new signed native shell; the public key
   and manifest URL are immutable for that shell.
4. Promote to beta only after the matrix passes. Production requires a separate
   documented architecture decision and store-policy review.
