# Release classification and channel ownership

## Supported distribution targets

| Target | Current policy | Update path |
| --- | --- | --- |
| Android / Google Play | Supported production target | Play native releases; Capgo web OTA begins in Phase 2. |
| iOS / App Store | Deferred until App Store distribution and OTA policy are approved | App Store native releases only until that approval. |
| Windows, direct download | Supported production target | Signed Tauri updater begins in Phase 1. |
| macOS, direct download | Supported production target | Signed/notarized Tauri updater begins in Phase 1. |
| Linux, direct download | Supported production target | AppImage self-update in Phase 1; deb/rpm remain package-manager managed. |
| macOS / Mac App Store | Not a supported distribution target | If introduced, use Mac App Store updates only. |

## Release classes

- `content`, `web_patch`, and `web_feature` may use the approved OTA lane only after compatibility checks pass.
- `native_optional` and `native_required` always use a native store or signed desktop release.
- Any change to Capacitor/Tauri dependencies or config, Android, iOS, `src-tauri`, Cargo, permissions, capabilities, or native build requirements is native. It cannot be promoted as web-only OTA.

## Channels and authority

| Channel | Audience | Promotion authority | Rollback authority |
| --- | --- | --- | --- |
| internal | PractoCore staff test installs | Release Manager | Release Manager or Incident Commander |
| beta | Opted-in customer testers | Release Manager after internal verification | Release Manager or Incident Commander |
| production | General customer fleet | Release Manager plus Security Approver | Release Manager or Incident Commander; notify Security Approver |

The named role holders and on-call Incident Commander must be recorded in the team password manager and release calendar. Production promotion requires two distinct people. Rollbacks can be executed immediately by either authorized rollback role, with an audit entry and follow-up review.
