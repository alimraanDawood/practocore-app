# Capgo mobile OTA release procedure

Android and iOS use `@capgo/capacitor-updater` in `onlyDownload` mode. A verified bundle is queued only after its download completes and activates on the next cold app launch; it never reloads an active matter or document session.

## Required Capgo setup

1. Create the `internal`, `beta`, and `production` channels in Capgo. The native app uses the service’s default production channel unless an approved native channel configuration changes it.
2. Generate Capgo v2 signing/encryption material in the managed vault; never in this repository.
3. Add the following GitHub Actions secrets: `CAPGO_API_KEY` and `CAPGO_PRIVATE_KEY`.
4. Configure Capgo channel version targeting to prevent downgrade below the installed native baseline.
5. Complete App Store policy/legal approval before enabling iOS OTA production delivery.

## Guarded OTA release

Run the **Capgo OTA** GitHub Actions workflow against `internal` first, then `beta`, then `production`. The workflow requires a unique semantic bundle version and:

- runs Capgo `bundle releaseType` before building;
- fails if any native plugin dependency changed;
- builds and validates `dist`;
- rechecks compatibility;
- uploads with `--fail-on-incompatible` and `--auto-min-update-version`.

Promotion to beta and production uses protected GitHub environments. Configure the production environment to require the Release Manager and Security Approver.

## Establishing a native baseline

The guarded OTA workflow intentionally cannot publish the first bundle after adding/removing/upgrading a native plugin. First ship and verify the signed Android/iOS native release. Then, as a separately approved operator action, upload the matching generated `dist` as Capgo’s native baseline using `--auto-min-update-version` but without `--fail-on-incompatible`. Resume the guarded OTA workflow only after that baseline is live.

## Device verification

For each channel/platform test: no update, successful download, full close/relaunch activation, offline launch, interrupted download, low storage, corrupt/tampered bundle, readiness timeout rollback, old native shell, and channel rollback. Verify that Settings → Updates displays the staged or failed state and that active editing is never reloaded automatically.
