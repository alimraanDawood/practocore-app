# AppSource Submission Package — PractoCore for Word & Outlook

**Prepared:** 2026-08-16
**Companion doc:** `ADDIN_PRODUCTION_DEPLOYMENT.md` (deployment paths, manifest details)

Everything Microsoft Partner Center will ask for, written out so submission is a
copy-paste exercise rather than a drafting exercise. **Word and Outlook are two
separate offers** — AppSource lists one add-in per host — so most sections below
appear twice.

---

## 0. Readiness checklist

| # | Item | Status |
|---|---|---|
| 1 | Task pane live at `app.practocore.com/word/taskpane` | ✅ 200 (verified 2026-08-16) |
| 2 | Task pane live at `app.practocore.com/outlook/taskpane` | ✅ 200 (verified 2026-08-16) |
| 3 | Auth callback live at `app.practocore.com/word/auth/callback` | ✅ 200 (verified 2026-08-16) |
| 4 | Icon URLs resolve over HTTPS | ✅ 200 (verified 2026-08-16) |
| 5 | `word-manifest.xml` passes acceptance test | ✅ valid (re-run 2026-08-16) |
| 6 | `outlook-manifest.xml` passes acceptance test | ✅ valid (re-run 2026-08-16) |
| 7 | Privacy Policy URL reachable | ⏳ built, **not deployed** — `practocore-landing` `/privacy` |
| 8 | Terms of Use URL reachable | ⏳ built, **not deployed** — `practocore-landing` `/terms` |
| 9 | Support URL reachable (`<SupportUrl>` target) | ⏳ built, **not deployed** — `practocore-landing` `/contact` |
| 10 | Registered company address confirmed on the legal pages | ✅ set 2026-08-16 — Makerere Incubation and Innovation Centre, COCIS Block B Level 5, Makerere University, Kampala, Uganda |
| 11 | Google OAuth redirect registered for `app.practocore.com` | ✅ registered 2026-08-16 — not yet exercised from a real task pane |
| 12 | Reviewer test account that can actually sign in | ❌ **TODO(owner)** — see §5 |
| 13 | Partner Center account enrolled in Microsoft 365 & Copilot | ❌ **TODO(owner)** |
| 14 | Listing assets (logo, screenshots) | ❌ **TODO** — see §4 |

Items 7–9 become ✅ the moment `practocore-landing` is deployed. Nothing else in
this package can be finished by anyone but the account owner.

---

## 1. Offer identity

| | Word offer | Outlook offer |
|---|---|---|
| Manifest file | `word-manifest.xml` | `outlook-manifest.xml` |
| Add-in GUID | `cf8f85d3-85c9-4b6e-9994-ea81ff9d22eb` | `12c1ef45-58c8-45ea-915b-3a7f6a5838c8` |
| Version | `1.0.0.0` | `1.0.0.0` |
| Publisher (`ProviderName`) | Fiika Tech Solutions Limited | Fiika Tech Solutions Limited |
| Permission requested | `ReadWriteDocument` | `ReadWriteItem` |
| Host platforms certified by validator | Word on Windows, Mac, web, iPad | Outlook on Windows, Mac, web |

> The publisher name in Partner Center **must match `<ProviderName>` exactly** —
> "Fiika Tech Solutions Limited", not "PractoCore". Verification is against the
> registered entity.

---

## 2. Store listing copy

### 2.1 Word — "PractoCore for Word"

**Name (30 char max):** `PractoCore for Word`

**Short description (100 char max):**
`Draft, cite and revise legal documents against your PractoCore matters, inside Word.`

**Long description:**

> PractoCore brings your matter file into Word.
>
> The task pane connects the document you are drafting to the matter it belongs
> to, so you are not copying context between windows. Ask for a clause, a
> submission, or a revision and it drafts against the facts already on the
> matter — parties, dates, prior filings and the documents in the matter vault.
>
> **What you can do from the pane**
> - Draft and insert text at the cursor, grounded in the open matter rather than in a blank prompt.
> - Pull authorities and precedent clauses, with a link back to the source for every citation.
> - Revise a selection — tighten it, change the register, or restructure it — without leaving the document.
> - Apply Ugandan court document formats.
> - Save the finished work product back to the matter vault.
>
> **Written for Ugandan practice**
> PractoCore's research tools sit on a corpus of Ugandan legislation and
> judgments. Citations resolve to the actual text of the authority, so you can
> check what the assistant tells you before you rely on it.
>
> **Requirements**
> A PractoCore account is required. The add-in is the companion to the
> PractoCore platform, not a standalone product. Generated text is a draft and
> must be reviewed by the practitioner responsible for the matter.

**Search keywords (max 7):** `legal drafting`, `law firm`, `litigation`, `legal research`, `Uganda`, `matter management`, `legal AI`

**Categories:** Productivity · Legal (select "Legal" as primary if available; otherwise Productivity)

**Industries:** Legal / Professional Services

---

### 2.2 Outlook — "PractoCore for Outlook"

**Name (30 char max):** `PractoCore for Outlook`

**Short description (100 char max):**
`Triage, summarise and reply to correspondence against your PractoCore matters.`

**Long description:**

> PractoCore puts the matter behind the email in front of you.
>
> Open the pane on a message and it connects that correspondence to the matter
> it belongs to — so a reply can be drafted with the parties, deadlines and
> prior filings already in hand, and so nothing important sits unfiled.
>
> **What you can do from the pane**
> - See the matter context for the message you are reading.
> - Summarise a long thread down to what actually needs a decision.
> - Draft a reply grounded in the matter file rather than in the thread alone.
> - File the message, and its attachments, to the matter vault.
>
> **Written for Ugandan practice**
> PractoCore is a matter, deadline and document platform built for Ugandan law
> firms. Deadlines calculated from correspondence follow the rules of the court
> seized of the matter.
>
> **Requirements**
> A PractoCore account is required. The add-in is the companion to the
> PractoCore platform, not a standalone product. Generated text is a draft and
> must be reviewed by the practitioner responsible for the matter.

**Search keywords (max 7):** `legal`, `law firm`, `email triage`, `matter management`, `litigation`, `Uganda`, `case management`

**Categories:** Productivity · Legal

**Industries:** Legal / Professional Services

---

## 3. Required URLs

Identical for both offers:

| Field | URL |
|---|---|
| Support | `https://www.practocore.com/contact` |
| Privacy policy | `https://www.practocore.com/privacy` |
| Terms of use | `https://www.practocore.com/terms` |
| Website | `https://www.practocore.com` |
| Support contact | `contact@practocore.com` |

⚠ All three of the first URLs 404 until `practocore-landing` is redeployed. The
pages exist in the repo (`app/pages/privacy.vue`, `terms.vue`, `contact.vue`);
they have not shipped. **Verify each returns 200 before submitting** —
AppSource fails the offer automatically on a dead URL, and a failed submission
goes back to the end of the review queue.

```bash
for u in contact privacy terms; do
  printf "%-8s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' -L https://www.practocore.com/$u)"
done
```

---

## 4. Listing assets

| Asset | Spec | Status |
|---|---|---|
| Store logo | 300×300 PNG | TODO — derive from `public/android-icon-96x96.png` source art at full resolution |
| Small logo | 48×48 PNG | TODO |
| Screenshots | 1366×768 PNG, 1–5 per offer | TODO — capture from the live pane |
| Video (optional) | 30–120s, YouTube/Vimeo link | Optional; skip for v1 |

**Screenshots to capture — Word:**
1. Pane open beside a draft, showing matter context loaded.
2. A drafted clause about to be inserted at the cursor.
3. A citation with its source link visible.
4. Saving work product back to the matter vault.

**Screenshots to capture — Outlook:**
1. Pane open on a message, matter context resolved.
2. A thread summary.
3. A drafted reply.
4. Filing the message to a matter.

Use real-looking but **fictional** party names and matter numbers. Do not
screenshot a live client matter — these images are published publicly.

---

## 5. Reviewer test account ⚠ highest-risk item

Microsoft's validators sign in and exercise the add-in. If they cannot log in,
the offer is rejected.

**The problem:** the task pane authenticates through Google OAuth in an Office
dialog (`${location.origin}/word/auth/callback`). A reviewer therefore needs
Google credentials, and handing a shared Google account to a reviewer is
awkward — Google frequently challenges new-device sign-ins with 2FA, which the
reviewer cannot satisfy.

**Options, best first:**
1. **Add an email + password sign-in path to the pane** for the reviewer to use.
   Most robust; removes the dependency on Google entirely. Requires app work.
2. **Provision a dedicated Google account** for review, with 2FA disabled and
   app-password/less-secure sign-in allowed, seeded with a demo firm and 2–3
   matters. Test the whole flow from a clean browser profile on a different
   network before submitting — that is what the reviewer's environment looks like.
3. Request a **video walkthrough exemption**. Microsoft sometimes accepts this
   for credential-gated add-ins, but it is discretionary and slows review.

Whichever is chosen, the account must have a seeded organisation and at least
one matter with documents, or the pane will look empty and be marked
non-functional.

**Test notes to paste into Partner Center:**

> PractoCore is a legal matter-management platform; this add-in is its Word
> [/Outlook] companion and requires a PractoCore account.
>
> 1. Open the add-in from the Home tab → PractoCore → Assistant.
> 2. The pane opens and prompts for sign-in. Use the credentials supplied above.
> 3. After sign-in the pane lists the demo firm's matters. Select "[demo matter name]".
> 4. [Word] Type a request such as "draft a short adjournment letter" and press send;
>    the draft appears in the pane with an Insert action that writes it into the document.
>    [Outlook] Open any message in the demo mailbox and use "Summarise thread".
> 5. Generated content is AI-produced and shown as a draft for the practitioner to review.
>
> The add-in reads the active document [/message] only when the user invokes an
> action on it. It does not scan the document library or mailbox in the background.

---

## 6. Submission steps

1. Partner Center → **Marketplace offers → New offer → Office add-in**.
2. Create the Word offer; upload `word-manifest.xml`.
3. Fill Store listing from §2.1, URLs from §3, assets from §4, test notes from §5.
4. Submit. Automated validation runs first, then human review.
5. Repeat 2–4 for Outlook with `outlook-manifest.xml` and §2.2.

Expect several business days to a few weeks. Business/tax verification on the
Partner Center account is separate and should be started first — it is often
the longest pole.

## 7. Before every (re)submission

```bash
cd practocore-app
npx office-addin-manifest validate word-manifest.xml
npx office-addin-manifest validate outlook-manifest.xml
```

Bump `<Version>` for any resubmission of an already-published offer; keep the
`<Id>` GUID the same, or it is treated as a new add-in.
