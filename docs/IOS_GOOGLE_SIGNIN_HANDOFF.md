# iOS Google Sign-In — Handoff Note (for the iOS Claude agent)

**Written 2026-07-13** by the Linux-side agent that did the Google Cloud Console setup.
Read this before wiring Google Sign-In / building the iOS target.

## TL;DR

The Google Cloud Console OAuth setup is **done** on a **new** project. Your job on the
Mac is the iOS-native glue: add the iOS platform, set the URL scheme, and put the client
IDs into a **local** `.env` (it is **gitignored** and did NOT travel with this merge).

## Project changed — this is the big one

- The OLD Firebase project **`practocore-72f49`** (number `488964126042`) is **GONE**
  (deleted / not on the account anymore).
- Everything now lives in the Google Cloud project **`practocore`** (number **`286763366119`**).
- Google Sign-In was fully set up on `practocore`. **FCM / Firebase migration was
  deliberately deferred** by the owner until Play Store publishing. So `google-services.json`,
  `config/firebase.config.ts`, and the web FCM config still point at the dead project —
  **leave them for now**, just don't be surprised.

## OAuth client IDs (project `practocore`, all created 2026-07-13)

These are public-by-design (they ship inside the app), safe to hardcode/commit.

| Client | Client ID |
|---|---|
| **Web** (this is the `aud` for native idTokens — the important one) | `286763366119-3t8ae6qc45smec3up32c1r9hlhi2uot9.apps.googleusercontent.com` |
| **iOS** (bundle `com.practocore.app`) | `286763366119-d5gbju720bdoahn01k1vuo69l5hqkan5.apps.googleusercontent.com` |
| Android (debug SHA-1 only, FYI) | `286763366119-hfhssquain2754uamdv1r9l48a42g5he.apps.googleusercontent.com` |

Consent screen is **In production** (external, non-sensitive scopes email/profile/openid),
so any Google account can sign in.

## Do this on the Mac

### 1. Set the local `.env` (gitignored — does not come from git)
The runtime reads these (see `nuxt.config.ts` → `googleWebClientId` / `googleIosClientId`,
consumed in `services/auth/index.ts`). Add to `practocore-app/.env`:
```bash
NUXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=286763366119-3t8ae6qc45smec3up32c1r9hlhi2uot9.apps.googleusercontent.com
NUXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=286763366119-d5gbju720bdoahn01k1vuo69l5hqkan5.apps.googleusercontent.com
```

### 2. Add the iOS platform & the URL scheme
There is no `ios/` dir yet. After `bun run build && npx cap add ios && npx cap sync ios`,
add the **reversed iOS client ID** as a URL scheme so the native Google flow can return.

In `ios/App/App/Info.plist`, under `CFBundleURLTypes`:
```
com.googleusercontent.apps.286763366119-d5gbju720bdoahn01k1vuo69l5hqkan5
```
(That's the iOS client ID reversed — the standard GoogleSignIn URL scheme.)

The plugin is **`@capgo/capacitor-social-login`** (already in `package.json`). It takes the
web + iOS client IDs at runtime from the config above — no `GoogleService-Info.plist` is
required for sign-in (that would only be needed for Firebase Auth / FCM, which is deferred).

### 3. Build
```bash
bun run build && npx cap sync ios && npx cap open ios   # then run from Xcode
```
Tapping "Login with Google" should open the native chooser and return via the URL scheme.

## Backend (separate, not a Mac task)
The `practocore-backend` server env must accept these `aud`s (web + iOS, NOT Android):
```
GOOGLE_OAUTH_CLIENT_IDS=286763366119-3t8ae6qc45smec3up32c1r9hlhi2uot9.apps.googleusercontent.com,286763366119-d5gbju720bdoahn01k1vuo69l5hqkan5.apps.googleusercontent.com
```
Verified against `POST /api/practocore/auth/google/native` in the backend `pb_hooks/auth.pb.js`.

## Deferred until Play Store (owner's call)
- Release/Play Android OAuth clients (need release keystore SHA-1 / Play App Signing key).
- Full Firebase/FCM migration off the dead `practocore-72f49` (new `google-services.json`,
  new `GoogleService-Info.plist`, new FCM service-account for `practocore-fcm`,
  new web `config/firebase.config.ts`).
