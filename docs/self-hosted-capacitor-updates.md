# Self-hosted Capacitor updates

PractoCore uses the Capacitor updater plugin as an on-device download,
extraction, next-launch activation, and rollback runtime. It does not use Capgo
Cloud: the signed native shell pins `updateUrl` to
`https://updates.practocore.com/api/capacitor/updates`, with mutation disabled
and Capgo statistics disabled.

The PractoCore Update Service implements that endpoint. It accepts the
plugin's privacy-safe native fields and returns either:

```json
{ "kind": "up_to_date" }
```

or an approved web bundle:

```json
{
  "version": "0.2.2+web.1",
  "url": "https://updates.practocore.com/bundles/0.2.2+web.1.zip"
}
```

## Publishing

1. Generate the static `dist` bundle and package it as a ZIP. Publish the ZIP
   to an HTTPS artifact origin owned by PractoCore.
2. Create a `web` release using `examples/capacitor-release.json`, replacing
   `bundleUrl` with the immutable artifact URL.
3. Point `internal`, then `beta`, then `production` at the release with the
   normal rollout percentage and pause controls.
4. Test full close/relaunch, offline boot, corrupt archive, readiness timeout,
   and rollback before promotion.

## Security gate

Do not enable production self-hosted OTA until the packaging pipeline encrypts
and/or signs each ZIP using a key pinned in the native shell and verifies it on
device. The self-hosted endpoint is protected by HTTPS and deterministic policy
today, but the plugin's simple external-ZIP response does not itself make our
service's Ed25519 export signature a native bundle-verification mechanism.
Keep the current lane internal-only until that native verification integration
has been completed and reviewed.
