# PractoCore Office Add-ins — Production Deployment & AppSource Listing

**Status:** production manifests cut & validated — 2026-07-03
**Manifests:** `word-manifest.xml`, `outlook-manifest.xml` (production) · `*-manifest.dev.xml` (localhost, keep for dev)

The task-pane code is already live in production (`app.practocore.com/word/taskpane`,
`/outlook/taskpane`, `/word/auth/callback` all return 200). What follows is everything
still needed to (A) ship the add-ins to real users and (B) list them in the Microsoft
marketplace (AppSource).

---

## What was done

- Created **production XML manifests** pointing at `https://app.practocore.com`
  (was `https://localhost:3000`), renamed `PractoCore (Dev)` → `PractoCore`, given
  fresh production GUIDs (so a prod copy won't collide with any sideloaded dev copy),
  and fixed the broken `SupportUrl` (old apex `practocore.com` does not resolve).
- Both pass Microsoft's **acceptance-test validator**
  (`npx office-addin-manifest validate <file>`) — the same check AppSource runs.

| | Word | Outlook |
|---|---|---|
| Manifest | `word-manifest.xml` | `outlook-manifest.xml` |
| Prod GUID | `cf8f85d3-85c9-4b6e-9994-ea81ff9d22eb` | `12c1ef45-58c8-45ea-915b-3a7f6a5838c8` |
| Task pane | `https://app.practocore.com/word/taskpane` | `https://app.practocore.com/outlook/taskpane` |

---

## BLOCKERS — do these before either distribution path works

### 1. Register the OAuth redirect URI (required for sign-in in production)
The pane signs in via Google OAuth through the Office Dialog API using
`${location.origin}/word/auth/callback`. In production that origin is
`app.practocore.com`, so it MUST be whitelisted or sign-in fails:

- **Google Cloud Console** → the OAuth 2.0 Client → *Authorized redirect URIs* →
  add `https://app.practocore.com/word/auth/callback`.
- **PocketBase** (`api.practocore.com`) → Settings → Auth providers → **Google** →
  ensure the same redirect URL is allowed.

(Outlook reuses the Word `/word/auth/*` routes, so this one URI covers both.)

### 2. Stand up Support / Privacy / Terms pages (required for AppSource, step B)
AppSource validation rejects listings without reachable **Support**, **Privacy
Policy**, and **Terms of Use** URLs. Today:
- `practocore.com/support` → apex does **not** resolve (broken).
- `www.practocore.com/contact` → **404** (page exists in the website repo but isn't
  serving in prod — the SPA fallback/route isn't deployed).
- Privacy Policy & Terms → **do not exist** (footer renders them as plain text, not links).

Action: deploy a working `https://www.practocore.com/contact` (support), publish a
**Privacy Policy** and **Terms of Use** page, then confirm each returns 200. The
manifests currently point `SupportUrl` at `https://www.practocore.com/contact` — make
that live. (Not a blocker for centralized org deployment in step A, only for AppSource.)

---

## A. Ship to users NOW (no marketplace needed)

Fastest path to lawyers using it today — no Microsoft review.

**Option A1 — Centralized deployment (recommended for firms on M365):**
1. Microsoft 365 admin center → **Settings → Integrated apps → Upload custom apps**.
2. Upload `word-manifest.xml` (and separately `outlook-manifest.xml`).
3. Assign to users/groups → deploy. It appears on their ribbon automatically
   (may take up to 24h to propagate).

**Option A2 — Individual sideload (testing / single users):**
- *Word (web):* Home → Add-ins → **Upload My Add-in** → pick `word-manifest.xml`.
- *Outlook (web/new):* Get Add-ins → **My add-ins → Custom Addins → Add from file** →
  `outlook-manifest.xml`.

Verify end-to-end after step-1 blocker: open the pane → **Assistant** button → sign in →
confirm a matter loads and a draft inserts.

---

## B. List in the Microsoft marketplace (AppSource)

> This is a **Microsoft Partner Center** submission and **cannot be automated** — it
> requires your Partner Center login, business verification, and Microsoft's manual
> review (typically several business days to weeks). The manifests are already
> AppSource-valid; below is the exact submission package.

### Prerequisites
- A **Partner Center** account enrolled in the **Microsoft 365 and Copilot** program
  (partner.microsoft.com). Business/tax verification can take days — start early.
- Blocker #2 resolved (Support + Privacy + Terms URLs live).
- **Test credentials** for Microsoft's validators: a working PractoCore login with a
  seeded org + at least one matter, so a reviewer can exercise the add-in. ⚠️ The pane
  is **Google-OAuth only** — a Google-based test account the reviewer can actually sign
  into (or a documented alternative sign-in) is needed, or validation will fail at login.

### Submit
1. Partner Center → **Marketplace offers → New offer → Office add-in**.
2. Upload the manifest (submit Word and Outlook as **separate offers** — AppSource lists
   one add-in per offer/host).
3. Fill **Store listing**: name (PractoCore), short + long description, category
   (Productivity / Legal), search keywords.
4. Upload **assets**: logo (300×300 PNG), 1–5 **screenshots** (1366×768) of the pane in
   Word/Outlook, optional 30–120s demo video.
5. **Support/Privacy/Terms URLs** (from blocker #2) + support contact (`hello@practocore.com`).
6. **Test notes + credentials** for validators (see prerequisites).
7. Submit → automated validation → manual review → publish.

### Re-validate before every submission
```bash
cd practocore-app
npx office-addin-manifest validate word-manifest.xml
npx office-addin-manifest validate outlook-manifest.xml
```

---

## Notes / future
- Manifests are **XML** (broadest reach today). Migrate to the **unified manifest**
  later for Teams/Copilot convergence (see `WORD_ADDIN_STRATEGY.md` Q1).
- To version-bump a published add-in, raise `<Version>` and resubmit the same GUID.
- Keep `*-manifest.dev.xml` for local development against `https://localhost:3000`.
