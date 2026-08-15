# Native Deep Linking

OS-level deep links open the installed PractoCore app (Tauri desktop, Capacitor
Android/iOS) straight to a page, instead of a browser. Two link shapes are
supported and both collapse to the same in-app route:

| Shape | Example | Works |
|-------|---------|-------|
| Custom scheme | `practocore://main/matters/matter/<id>` | Everywhere, no server setup, testable today |
| HTTPS App/Universal Link | `https://app.practocore.com/main/matters/matter/<id>` | After the domain's `.well-known` files are live |

The HTTPS form is the *same* absolute link the backend already emits in
notifications (see `utils/notificationRoute.ts`), so one link serves as a push
target, a bell-list destination, and an App Link that opens the native app.

## How it flows

1. The OS hands the native shell the raw URL.
2. `utils/deepLink.ts` → `resolveDeepLinkPath()` validates it (same-origin only —
   a deep link is untrusted input) and reduces it to a relative path.
3. It reaches the router by one of two paths, split by app state:
   - **Warm** (app already running): `plugins/deep-links.client.ts` listens on
     Capacitor `appUrlOpen` / Tauri `onOpenUrl` and calls `navigateTo`.
   - **Cold** (link launched the app): `pages/index.vue` — the boot spinner that
     already decides where to land — reads the launch URL via
     `resolveColdStartDeepLink()` (`composables/useColdStartDeepLink.ts`) and
     routes there *instead of* its default `/main`. Doing it here, in the same
     decision as the auth check, is what avoids a post-mount `navigateTo` racing
     (and losing to) the index redirect — which showed up as the target page
     flashing then bouncing to `/main`.
4. `navigateTo(path)` runs the SPA router. `auth.global.ts` handles login
   redirect + `next` for protected pages automatically.

No new routing table: this reuses the query-param deep-link scheme already built
into the pages (`?tab=`, `?action=`, matter/settings tabs, etc.).

## Platform configuration (all in-repo, already wired)

- **Tauri** — `tauri-plugin-deep-link` + desktop-only `tauri-plugin-single-instance`
  (`src-tauri/Cargo.toml`), registered in `src-tauri/src/lib.rs`; scheme in
  `src-tauri/tauri.conf.json` → `plugins.deep-link.desktop.schemes`;
  `deep-link:default` capability. Linux/Windows register the scheme at runtime
  via `register_all()`; macOS reads it from the bundle.
- **Android** — two `<intent-filter>`s in `android/app/src/main/AndroidManifest.xml`
  (`practocore` scheme; `autoVerify` HTTPS App Links for `app.practocore.com`).
- **iOS** — `practocore` scheme in `ios/App/App/Info.plist` (`CFBundleURLTypes`);
  `applinks:app.practocore.com` in both `App.entitlements` and
  `App-Debug.entitlements`.

## Domain-side files (deploy-time)

Both already exist in `public/.well-known/` and ship with the app deployment:

- `assetlinks.json` — Android. Contains the SHA-256 of the signing cert. **This
  must match the cert the shipped AAB/APK is signed with.** If Play App Signing
  is enrolled, use the fingerprint from Play Console → Setup → App integrity, not
  the local upload key. Regenerate with:
  ```
  keytool -list -v -keystore key-store.jks -alias <alias> | grep SHA256
  ```
- `apple-app-site-association` — iOS. `appID` is `MXTY27437P.com.practocore.app`.
  Must be served at `https://app.practocore.com/.well-known/apple-app-site-association`
  with `Content-Type: application/json` and **no** file extension.

⚠️ The static host for `app.practocore.com` must serve these real files, not the
SPA `index.html` fallback. Verify after deploy:
```
curl -sI https://app.practocore.com/.well-known/assetlinks.json | grep -i content-type
curl -s  https://app.practocore.com/.well-known/apple-app-site-association
```

## Testing

**Android (custom scheme, works without the live domain):**
```
adb shell am start -a android.intent.action.VIEW -d "practocore://main/settings?tab=billing"
```
**Android (App Link, after assetlinks.json is live + app reinstalled):**
```
adb shell am start -a android.intent.action.VIEW -d "https://app.practocore.com/main/dashboard"
adb shell pm get-app-links com.practocore.app   # shows verification state
```
**iOS Simulator:**
```
xcrun simctl openurl booted "practocore://main/dashboard"
```
**Tauri desktop (Linux):** after `bun tauri dev` has run once (registers the
scheme), from another terminal:
```
xdg-open "practocore://main/settings?tab=profile"
```

## Adding new deep-link targets

Nothing to change here — `resolveDeepLinkPath` passes any same-origin path
straight through. Just make sure the page understands the query params (the
in-app deep-link scheme in `DEEP_LINKING_IMPLEMENTATION_REPORT.md`).
