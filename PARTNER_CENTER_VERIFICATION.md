# Partner Center Enrolment & Business Verification — prep

**Prepared:** 2026-08-16 · sources are current Microsoft Learn docs (checked this date)
**Companion docs:** `APPSOURCE_SUBMISSION.md` (the listing package) · `ADDIN_PRODUCTION_DEPLOYMENT.md`

This is the account-level gate that sits *before* any add-in submission. It is
the longest pole in publishing the Word and Outlook add-ins, and it is entirely
owner-driven — nobody can complete it on your behalf, because it involves
signing legal agreements, government ID, and company registration documents.

Typical duration once submitted: **3–5 business days**, longer if any check
bounces back for more information.

---

## ✅ Uganda is supported

Checked against Microsoft's supported-publisher list (page last updated
2026-04-07): **Uganda is listed.** A company legally resident in Uganda can
publish to Microsoft Marketplace / AppSource. This was the one thing that could
have invalidated the whole plan; it doesn't.

---

## The five checks

Microsoft runs these independently. The account is not verified until all
required checks pass.

| Check | What it confirms | What you supply |
|---|---|---|
| **Email** | The primary contact's business email is real and receives mail | A business email on your own domain — **not Gmail** |
| **Identity** | The identity of at least one user on the account | Government-issued ID whose name matches the account user exactly |
| **Employment** | The primary contact works for the business | **Domain ownership documentation** from the registrar |
| **Business** | The company is legally registered and exists at the stated address | Certificate of incorporation / business registration |
| **Additional** | Discretionary trust check on some businesses | A questionnaire, if you're selected |

---

## ⚠ Three blockers to clear *before* you start

Starting enrolment before these are fixed means a rejected check and an appeal
cycle, which is far slower than fixing them up front.

### 1. Domain privacy will fail employment verification — CONFIRMED

Employment verification requires domain documentation that includes *"business
name, address, domains, and dates (purchase and expiration)"* and that **matches
your partner account**, from an authorized registrar.

I checked the public WHOIS for `practocore.com` on 2026-08-16:

```
Registrar:               NAMECHEAP INC
Registrant Name:         Redacted for Privacy
Registrant Organization: Privacy service provided by Withheld for Privacy ehf
Registrant Street:       Kalkofnsvegur 2, Reykjavik, 101, IS
Creation Date:           2025-07-19
```

The public record names an **Icelandic privacy proxy**, not PractoCore Technologies
Limited in Kampala. As it stands this does not evidence that the domain belongs
to your business, and Microsoft will reject it.

**Fix — do both:**
- In the Namecheap account, make sure the *underlying* registrant contact is
  **PractoCore Technologies Limited** at the registered company address, not a
  personal name. If the domain was registered personally, update the registrant
  contact first. (This may trigger a 60-day transfer lock — irrelevant here, but
  worth knowing.)
- Then either temporarily **disable WHOIS privacy** so the public record shows
  the company, or request a **domain registration / ownership certificate** from
  Namecheap support showing registrant name, address, domain and the purchase
  and expiry dates. The certificate is usually the cleaner route — no public
  exposure of your address.

Allow a few days for this. It is the single most likely reason a first
enrolment attempt fails.

### 2. The primary contact needs a business email, not Gmail

The docs are explicit: *"Use only an employee business email address during
email verification, not a personal or free email account."*

You'll need something like `dawood@practocore.com`. This also feeds blocker 3.

### 3. You need a Microsoft Entra ID work account, not a personal account

*"You sign up for a developer account using your Microsoft Entra ID work
account."* A personal Microsoft account (outlook.com / hotmail / gmail-backed)
is **not** sufficient — the docs say plainly: *"You can't use a personal email
address to access a Partner Center account."*

Verified on 2026-08-16:
- **No Entra tenant exists for `practocore.com`** — `login.microsoftonline.com`
  returns `AADSTS90002: Tenant 'practocore.com' not found`, and the user-realm
  lookup returns `NameSpaceType: Unknown`. So there is nothing to sign in to
  yet; the tenant has to be created.
- **Mail is on Namecheap Private Email** — MX records are
  `mx1/mx2.privateemail.com`. It works and can receive verification codes.
- **DNS is on Namecheap BasicDNS** — nameservers are
  `dns1/dns2.registrar-servers.com`, so DNS records are edited in Namecheap's
  **Advanced DNS** tab.

⚠ **Do not use `contact@practocore.com` as the work account address.** Microsoft
rejects generic role-based names outright: *"must not use generic role-based
names, including: info@, admin@, email@, marketing@."* Use a **named personal
work address** — e.g. `dawood@practocore.com` — which also fits identity
verification, since that check matches a government ID to a named user. Keep
`contact@practocore.com` as the public support address in the listing and
manifests; that is a separate thing.

Required **even though the add-ins are free** — the enrolment workflow asks for
business information regardless of monetisation.

See §"Step-by-step: creating the work account" below.

---

## ⚠ Address consistency — decide this now

Business verification requires that *"your business name and address match
official registration records exactly, without spelling errors or
abbreviations."*

Reconciled 2026-08-24 against the URSB registration of **PractoCore
Technologies Limited** (CO. FORM 1, dated 19 August 2026). The address now
published on `practocore.com/privacy`, `/terms` and `/contact`, and which goes
into the Partner Center publisher profile, is the registered office:

> Kiswa, Zone 2, Nakawa Division, Kampala, Uganda
> P.O. Box 216701, Kampala GPO

This replaces the earlier Makerere Incubation Centre address, which was the
operating space rather than a registered office, and the earlier publisher
identity (Fiika Tech Solutions Limited). Both manifests, the app `package.json`
author field, the splash screens and `practocore-landing/app/data/legal.ts`
now carry the new entity.

**Still verify against the issued certificate of incorporation**, not the
application form — the form above records the *proposed* address, and Partner
Center matches the registration record character for character. If the
certificate renders the address differently, change `ENTITY` in
`practocore-landing/app/data/legal.ts` to match it exactly; every published
surface reads from there.

---

## Documents to have scanned and ready

- **Certificate of incorporation / registration** for PractoCore Technologies
  Limited from URSB, showing the company name, registered address and dates.
- **Domain ownership certificate** from Namecheap (or an un-redacted WHOIS
  record) showing the company as registrant — see blocker 1.
- **Government-issued photo ID** for the person who will be the account's
  verified user; the name must match the Partner Center user record exactly.
- Company legal name, registered address, and primary contact details, all
  written exactly as they appear on the registration documents.
- **A standard credit or debit card issued in Uganda**, with international/online
  transactions enabled. Prepaid and virtual cards are rejected outright — see
  step 4. No charge is made, but the enrolment will not proceed without one.

---

## Order of operations

1. Fix the domain registrant + obtain the ownership certificate (blocker 1).
2. Stand up a **named** business mailbox on `practocore.com` (blocker 2) — not
   `contact@`, which Microsoft rejects as role-based.
3. Create the Microsoft Entra ID work account for that domain (blocker 3) —
   full walkthrough in §"Step-by-step: creating the work account".
4. Confirm the registered address against the URSB certificate; reconcile the
   legal pages if it differs.
5. Go to the [Partner Center Office enrolment page](https://partner.microsoft.com/dashboard/account/v3/enrollment/introduction/office)
   and create the account with the work account.
6. Complete the publisher profile — company info, publisher info, contact info.
7. Accept the **Microsoft AI Cloud Partner Program Agreement** and the
   **Microsoft Office Agreement**. ⚠ You must be authorised to sign on the
   company's behalf.
8. Upload business and domain documents under **Account settings → Legal info →
   Verification Summary → Business Information**.
9. Watch the primary contact's inbox — Microsoft sends all requests for further
   information there, and only there. Add `microsoft.com` as a safe sender and
   check spam.
10. When overall status reads **Authorized**, enrol the publisher in the
    **Microsoft 365 and Copilot** program (Settings → Account settings →
    Programs → Microsoft 365 and Copilot → Get Started), then proceed to
    `APPSOURCE_SUBMISSION.md`.

---

## Step-by-step: creating the work account

This is the part the "please sign in" prompt is actually asking for. Roughly
45 minutes of clicking, plus up to an hour waiting for DNS.

### Step 0 — create the mailbox first (Namecheap)

The work account address must be able to receive a verification code, so the
mailbox has to exist **before** you start.

1. Namecheap dashboard → **Private Email** → your `practocore.com` subscription.
2. Create a mailbox for a named person — `dawood@practocore.com`, not `contact@`.
3. Send yourself a test message and confirm it arrives.

If your Private Email plan has no spare mailbox, add one. Do not work around
this with a Gmail address or a role alias — both fail.

### Step 1 — start enrolment

1. Go to **<https://partner.microsoft.com/dashboard/account/v3/enrollment/introduction/office>**
   (this is the Microsoft 365 and Copilot / Office enrolment entry point).
2. When offered an existing account or a new one, choose **create a new work
   account**. Do not sign in with a personal Microsoft account or the Gmail
   address.
3. Enter `dawood@practocore.com` and choose an **Organization** type billing
   account.

### Step 2 — billing account details ⚠ exact-match matters

The **Create a new billing account** screen asks for the organisation's legal
name, address, contact and phone.

> *"Enter your business's legal business name and address exactly as it appears
> in official business or registration records... Mismatches can delay or
> prevent successful verification."*

- Legal name: **PractoCore Technologies Limited** — exactly as on the URSB
  certificate, no abbreviations.
- Address: whatever the URSB certificate shows as the registered office. See
  the address-consistency warning above — resolve it *before* typing it here.
- Use standard Western European characters only.
- Contact: this becomes the **primary contact** for Partner Center, and is the
  only address that receives verification mail.

### Step 3 — sign-in details

Provide the username, domain and password for the new tenant. At this point you
will be on an `onmicrosoft.com` domain (e.g. `practocore.onmicrosoft.com`) —
that is expected and fine. The custom domain gets attached in step 5.

### Step 4 — payment method ⚠ prepaid cards are rejected

The flow asks for a card. Per Microsoft: *"Providing this information doesn't
result in any charges at the time of sign-up. Charges apply only when a
purchase is made."* Publishing a free add-in incurs no fee — the card is only
ever an identity/validity signal here.

**Prepaid and virtual cards do not work.** Microsoft's docs are explicit:

> *"Revolut and prepaid cards are not valid... **Prepaid cards**: Error code
> `HIT_RSK_2100039`, **Revolut cards**: Error code `2100037`. Please use a
> standard credit or debit card issued by a recognized financial institution."*

Encountered 2026-08-16 — a prepaid card was declined at this step. This is
policy, not a transient failure; retrying the same card cannot succeed.

**What the card must be:**
- A **standard credit or debit card** from a recognized bank. Not prepaid, not
  virtual, not Revolut/Wise-style e-money.
- **Issued in the same country as the billing account.** The billing account is
  Uganda, so a Uganda-issued card. A card from another country/region is
  commonly declined.
- **Cardholder name and billing address must match the bank's records exactly** —
  a mismatch in name format or postal code alone is enough to decline.

**Common local gotcha:** many Ugandan bank debit cards are restricted to
domestic transactions by default. If a legitimate bank card is declined, ask
the issuing bank to enable **international / online (e-commerce) transactions**
before retrying.

**If a card is declined:** wait 48 hours before retrying so any authorization
hold is reversed and released. Repeated rapid attempts can compound the block.

**If no acceptable card is available:** raise a ticket with
[Partner Center support](https://partner.microsoft.com/support) explaining that
the enrolment is for publishing a **free** Office add-in with no purchase
intended, and ask what alternatives exist for your region. This is a known
friction point — the enrolment workflow requests payment details even where no
monetisation is involved, and there is no self-serve path that skips it.

### Step 5 — attach `practocore.com` to the tenant

1. Sign in to the **Microsoft Entra admin center**: <https://entra.microsoft.com>
2. Go to **Entra ID → Domain names → Add custom domain**.
3. Enter `practocore.com` (with the `.com` — it is rejected without a TLD) and
   select **Add domain**.
4. Entra shows a **TXT record** to create. Copy it — it looks like
   `MS=ms12345678`.

### Step 6 — add the TXT record at Namecheap

DNS for `practocore.com` is on Namecheap BasicDNS, so:

1. Namecheap → **Domain List** → **Manage** next to `practocore.com` →
   **Advanced DNS**.
2. **Add New Record** → type **TXT Record**.
3. **Host:** `@`  ·  **Value:** the `MS=ms…` string from Entra  ·  **TTL:** 60 min.
4. Save.

🚨 **Do not touch the MX records.** They point at `privateemail.com` and must
stay that way — Entra is being used for identity only, and your mail stays with
Namecheap. Adding Microsoft MX records is what would break email. The domain
verification is TXT-only.

Note there is already an SPF TXT record (`v=spf1 include:spf.privateemail.com ~all`)
and a Google site-verification TXT on the apex. Adding another TXT alongside
them is fine — multiple TXT records on `@` coexist normally.

### Step 7 — verify

1. Back in **entra.microsoft.com → Entra ID → Domain names**, select
   `practocore.com` and press **Verify**.
2. If it fails, wait an hour and retry — DNS propagation. Confirm the record is
   live from a terminal:
   ```bash
   dig +short TXT practocore.com | grep MS=
   ```
3. Optionally set `practocore.com` as the primary domain, then create/rename the
   user so you sign in as `dawood@practocore.com` rather than the
   `onmicrosoft.com` address.

### Step 8 — enrol in Microsoft 365 and Copilot

1. Partner Center → **Settings (gear) → Account settings → Programs**.
2. On the **Microsoft 365 and Copilot** tile, choose **Get Started**.
3. Select or create the publisher account; enter the company name.
4. Accept the **Microsoft Publisher Agreement** (and the **Microsoft AI Cloud
   Partner Program Agreement** if new). ⚠ You must be authorised to sign for
   the company.

### Step 9 — upload verification documents

**Account settings → Legal info → Verification Summary → Business Information** —
upload the URSB certificate and the Namecheap domain ownership certificate
(blocker 1). Then wait 3–5 business days, watching the primary contact's inbox.

---

## Things that quietly matter

- **The publisher name must match `<ProviderName>` in the manifests** —
  "PractoCore Technologies Limited". Both manifests already carry it.
- **The publisher account can't be changed after an offer is created.** Get the
  publisher identity right before creating the Word offer.
- Only the **primary contact** receives verification emails, even though other
  roles can action them. Make sure that mailbox is watched.
- Until verification completes, Partner Center **blocks publishing** — so there
  is no point preparing offers in parallel expecting to submit early.
- Business/tax profile information may be requested even for free add-ins.

---

## Sources

- [Supported publisher countries and regions](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/supported-countries-regions) — Uganda confirmed
- [Understand the verification process in Partner Center](https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process)
- [Open an Office account in Partner Center](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/open-a-developer-account)
- [Microsoft Marketplace step-by-step submission guide](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/add-in-submission-guide)
