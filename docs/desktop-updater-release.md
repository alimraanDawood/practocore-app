# Desktop updater release procedure

The desktop updater uses Tauri's mandatory signature verification. The application embeds the public key only in a signed release build; GitHub Releases hosts the signed update payloads and `latest.json`.

## Required GitHub Actions secrets

- `TAURI_UPDATER_PUBLIC_KEY`: the public key content produced with `tauri signer generate`.
- `TAURI_SIGNING_PRIVATE_KEY`: protected private key content or path available to the runner.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: private-key password, if one was set.

The workflow deliberately fails before desktop packaging if the public or private signing key is absent. Do not put these values in `.env`, repository files, workflow logs, or release notes.

## What a tagged release produces

For Windows x64, macOS arm64/x64, and Linux x64 the release workflow creates the normal download assets plus a signed updater payload and signature. Once all four desktop jobs pass, it creates `latest.json` containing the platform URLs and exact signature contents, uploads it to the draft release, then publishes the release.

Clients use the stable HTTPS endpoint:

`https://github.com/<owner>/<repository>/releases/latest/download/latest.json`

The native shell rejects any updater payload whose signature does not match its embedded public key.

## Release verification

Before production promotion, install the previous signed build on a clean test machine for each target and verify:

1. A newer release is detected in Settings → Updates.
2. Downloading does not interrupt active work; the update remains staged until the user selects restart.
3. macOS and Linux restart into the new version; Windows exits into the installer and starts the updated app.
4. The displayed release notes/version match `latest.json`.
5. A modified asset, signature, or `latest.json` is rejected and the old app continues to launch.
6. Offline checks, interrupted download, full-disk staging, and a failed restart preserve a usable installed version.

Package-manager Linux installations (deb/rpm) remain managed by their package manager; the updater target is the direct AppImage distribution.
