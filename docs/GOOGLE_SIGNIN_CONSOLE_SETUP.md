# Native Google Sign-In — Google Cloud Console Setup

Setup steps to make the native Capacitor Google Sign-In (implemented 2026-07-10) work
on a real device. This is the **console/config** work — the app + backend code is
already done. See `services/auth/index.ts` and backend `pb_hooks/auth.pb.js`
(`POST /api/practocore/auth/google/native`).

## Your project's values (referenced throughout)

| Thing | Value |
|---|---|
| Firebase project | `practocore-72f49` |
| Project number | `488964126042` |
| Android package name | `com.practocore.app` |
| Backend base URL | `https://api.practocore.com` |
| Release keystores | `practocore-app/KEY-NAME.keystore`, `key-store.jks` |

---

## Step 0 — Get your SHA-1 fingerprints first

You need a SHA-1 for **every** keystore that signs a build Google sign-in must run on:
your **debug** keystore (dev builds) and your **release** keystore (Play Store / signed APKs).

```bash
# Debug (auto-created by Android Studio; password is literally "android")
keytool -list -v -alias androiddebugkey \
  -keystore ~/.android/debug.keystore -storepass android -keypass android | grep SHA1

# Release — your app has two; use whichever actually signs your release build
keytool -list -v -keystore practocore-app/KEY-NAME.keystore | grep SHA1
keytool -list -v -keystore practocore-app/key-store.jks   | grep SHA1
```

> If you publish through **Google Play App Signing**, Play re-signs your app with a
> *different* key. You must ALSO grab that SHA-1 from **Play Console → your app →
> Test and release → App integrity → App signing key certificate**, or Google
> sign-in will fail for users who install from the Play Store even though it works
> on your local release build. This is the #1 cause of "works on my device, broken
> in production."

Copy each SHA-1 (format `AB:CD:EF:...`) — you'll paste them in Step 2.

---

## Step 1 — Open the right project

1. Go to <https://console.cloud.google.com/apis/credentials>
2. Top-left project picker → select the project backing Firebase `practocore-72f49`
   (same project number `488964126042`).
3. If prompted, make sure the **OAuth consent screen** is configured
   (**APIs & Services → OAuth consent screen**): User type **External**, app
   name/logo/support email filled, and your domain (`practocore.com`) under
   authorized domains. Add your Google account as a **Test user** while it's in
   "Testing", or **Publish** the app for public users. Scopes needed are just
   `email`, `profile`, `openid` (the default non-sensitive set — no verification
   review required).

---

## Step 2 — Create the three OAuth client IDs

**APIs & Services → Credentials → + Create credentials → OAuth client ID**, three times.

### 2a. Web client  ← this is the important one
- **Application type:** Web application
- **Name:** `PractoCore Web (mobile idToken audience)`
- **Authorized JavaScript origins / redirect URIs:** you can leave these empty for
  the native flow (the mobile idToken doesn't use them). If you also want the web
  login to keep working, add your existing web origins/redirect here.
- **Create** → copy the **Client ID** (ends in `.apps.googleusercontent.com`).

> Why it matters: the idToken minted on **Android** carries this **web** client ID
> as its `aud`. This one value goes into **both** the app and the backend (Step 3).

### 2b. Android client
- **Application type:** Android
- **Name:** `PractoCore Android`
- **Package name:** `com.practocore.app`
- **SHA-1 certificate fingerprint:** paste your **debug** SHA-1.
- **Create.**
- Then create **another Android client** (same package name) for each additional
  SHA-1 — release keystore and, if applicable, the Play App Signing key. (One SHA-1
  per Android OAuth client; add as many as you have keystores.)

> The Android client has no "secret" — its job is purely to let Google authorize
> requests coming from an app with that package + signing fingerprint. If it's
> missing/mismatched, the native picker throws `10: DEVELOPER_ERROR`.

### 2c. iOS client (only if you ship iOS)
- **Application type:** iOS
- **Name:** `PractoCore iOS`
- **Bundle ID:** `com.practocore.app`
- **Create** → copy the **Client ID**.

---

## Step 3 — Wire the IDs into your app + backend

**Frontend** (`.env` for the app build):
```bash
NUXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id from 2a>
NUXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios client id from 2c>   # omit if no iOS
```

**Backend** (env for `practocore-backend`) — list **every** `aud` you'll accept,
comma-separated. Because Android idTokens use the **web** client ID, the web ID is
required; add the iOS ID if you ship iOS:
```bash
GOOGLE_OAUTH_CLIENT_IDS=<web client id from 2a>,<ios client id from 2c>
```

> Do **not** put the Android client ID here — Android idTokens are
> `aud = web client id`, not the Android one.

---

## Step 4 — Refresh `google-services.json` (recommended)

Your current `google-services.json` has an empty `oauth_client` array. After creating
the clients, download a fresh copy so the file matches:

1. **Firebase console** → project `practocore-72f49` → **Project settings → Your apps
   → Android app (`com.practocore.app`)**.
2. Under **SHA certificate fingerprints**, add the same SHA-1s (Firebase and the
   Cloud console OAuth clients share the same underlying project, but adding them
   here keeps things consistent and enables Firebase Auth if you use it).
3. **Download google-services.json** and replace `practocore-app/google-services.json`.
4. `npx cap sync android`.

The Capgo plugin reads the web client ID you pass at runtime, so a populated
`google-services.json` isn't strictly required for sign-in — but keeping it in sync
avoids confusion and is needed for other Firebase features (you already use FCM).

---

## Step 5 — Rebuild and test

```bash
cd practocore-app
bun run build && npx cap sync android && npx cap run android
```

**Expected:** tapping "Login with Google" opens the native account chooser instantly
(no browser), and cancelling just resets the button.

**If it fails, the error code tells you which step to revisit:**

| Symptom | Cause | Fix |
|---|---|---|
| `10: DEVELOPER_ERROR` | SHA-1 or package mismatch | Step 2b — wrong/missing SHA-1 for the keystore that signed this build |
| Backend returns `401 "issued for a different app"` | `aud` not in allow-list | Step 3 — put the **web** client ID in `GOOGLE_OAUTH_CLIENT_IDS` |
| Backend `500 "not configured"` | env unset | Step 3 — `GOOGLE_OAUTH_CLIENT_IDS` empty on server |
| Works in dev, breaks from Play Store | Play re-signs the app | Step 0 note — add the **Play App Signing** SHA-1 as another Android client |

**The two must-not-forget items:** the **web** client ID is what both the app and
backend key off of (not the Android one), and **every signing keystore needs its own
Android OAuth client** — including Play App Signing if you use it.
