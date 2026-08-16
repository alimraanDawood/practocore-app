// services/billing — the client for the v2 payment platform.
//
// Everything here talks to `internal/billingv2` and `internal/entitlements` in
// the backend. It deliberately does NOT wrap the v1 `services/subscriptions`
// surface: v1 still owns plan and term provisioning, v2 owns money movement and
// access, and blurring the two is how the old system ended up with billing
// state written in two places and read in none.
//
// The one rule worth remembering: the client can no longer create value. A
// credit top-up raises an invoice and returns a link to pay it; credits appear
// only after settlement, on the server.

import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase';
import { reportBillingBlock } from './gate';

/** AccessLevel mirrors entitlements.Level. Ordered most to least permissive. */
export type AccessLevel = 'full' | 'grace' | 'read_only' | 'locked';

/** AccessCapability mirrors entitlements.Capability. */
export type AccessCapability = 'read' | 'write' | 'ai' | 'export' | 'billing';

/** AccessReason mirrors entitlements.Reason — why the level is what it is. */
export type AccessReason =
  | 'active'
  | 'contract_grant'
  | 'trial_active'
  | 'awaiting_payment'
  | 'no_subscription'
  | 'in_grace'
  | 'expired'
  | 'suspended';

/**
 * Access is the same Decision the request guard enforces. Reading it rather
 * than recomputing expiry from a term end date is what keeps the banner, the
 * read-only affordances and the server's 402 in agreement.
 */
export interface Access {
  level: AccessLevel;
  reason: AccessReason;
  is_trial: boolean;
  days_remaining: number;
  term_end: string | null;
  grace_end: string | null;
  read_only_end: string | null;
  capabilities: AccessCapability[];
  /**
   * When an already-paid future term begins, if one is queued. It grants
   * nothing now — the current term still governs — but it is the reason not to
   * warn a firm about an expiry it has already paid to avoid.
   */
  next_term_start: string | null;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitAmount?: number;
  total?: number;
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | string;
  /** Already formatted for display by the server — one implementation of how money is written. */
  total: string;
  paid: string;
  currency: string;
  source: string;
  issuedAt: string;
  paidAt: string;
  lines: InvoiceLine[] | null;
}

/** CreditPurchase is a raised invoice awaiting payment — NOT a granted balance. */
export interface CreditPurchase {
  invoice_id: string;
  invoice: string;
  credits: number;
  total: string;
  currency: string;
  checkout_url: string;
  /** Always false. Present so no caller mistakes this for a completed top-up. */
  granted: boolean;
}

function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: pocketbase.authStore.token };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/**
 * billingError turns a failed response into an error carrying the server's own
 * message where it has one. The guard's 402 in particular ships a rich payload
 * describing why access is restricted; discarding it and showing "Request
 * failed (402)" wastes the whole point of the graduated model.
 */
async function billingError(res: Response, fallback: string): Promise<Error> {
  let message = fallback;
  let payload: any = null;
  try {
    payload = await res.json();
    if (typeof payload?.message === 'string' && payload.message) message = payload.message;
  } catch {
    // Non-JSON body — keep the fallback.
  }
  if (res.status === 402) reportBillingBlock(payload);
  const err = new Error(message) as Error & { status?: number; payload?: any };
  err.status = res.status;
  err.payload = payload;
  return err;
}

/** getAccess reads the current access decision for the signed-in user. */
export async function getAccess(): Promise<Access> {
  const res = await fetch(`${SERVER_URL}/api/practocore/access`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) throw await billingError(res, `Could not load access state (${res.status})`);
  return res.json();
}

/** listInvoices returns the billing holder's invoices, newest first. */
export async function listInvoices(): Promise<Invoice[]> {
  const res = await fetch(`${SERVER_URL}/api/practocore/billing/invoices`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) throw await billingError(res, `Could not load invoices (${res.status})`);
  const j = await res.json();
  return j?.invoices ?? [];
}

/**
 * checkoutLinkFor mints a payment link for an invoice the caller's holder owns.
 * Used to resume payment on an invoice raised earlier — including one raised by
 * us for a contract firm.
 */
export async function checkoutLinkFor(invoiceId: string): Promise<{ url: string; invoice: string }> {
  const res = await fetch(
    `${SERVER_URL}/api/practocore/billing/invoices/${encodeURIComponent(invoiceId)}/checkout-link`,
    { method: 'POST', headers: authHeaders(true) },
  );
  if (!res.ok) throw await billingError(res, `Could not create a payment link (${res.status})`);
  return res.json();
}

/**
 * subscriptionCheckoutLink mints a payment link for a subscription term that
 * was never settled.
 *
 * Subscribing returns a checkout link exactly once, in the subscribe response.
 * Lose it — close the sheet, miss the mobile-money prompt, run out of airtime —
 * and the only way back used to be subscribing again, which raised a second term
 * and a second bill. This resumes the original one instead: the term's invoice is
 * idempotent, so paying can be retried without ever billing twice.
 */
export async function subscriptionCheckoutLink(
  subscriptionId: string,
): Promise<{ url: string; invoice: string }> {
  const res = await fetch(
    `${SERVER_URL}/api/practocore/billing/subscriptions/${encodeURIComponent(subscriptionId)}/checkout-link`,
    { method: 'POST', headers: authHeaders(true) },
  );
  if (!res.ok) throw await billingError(res, `Could not create a payment link (${res.status})`);
  return res.json();
}

/**
 * cancelSubscriptionTerm abandons an unpaid term and voids its bill.
 *
 * Only ever an unpaid one. A settled term is refused by the server, because
 * ending cover someone has paid for is a refund decision rather than a button.
 * A 409 means a charge is still in flight — the payer may have a prompt open on
 * their handset this second — and the right answer is to wait, not to retry.
 */
export async function cancelSubscriptionTerm(subscriptionId: string): Promise<void> {
  const res = await fetch(
    `${SERVER_URL}/api/practocore/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: 'POST', headers: authHeaders(true) },
  );
  if (!res.ok) throw await billingError(res, `Could not cancel this subscription (${res.status})`);
}

/**
 * purchaseCredits raises an invoice for AI credits and returns a checkout link.
 *
 * This replaces v1's `topUpCredits`, which posted {credits, paid} and had the
 * server add the balance on the spot — no payment collected anywhere in the
 * path, and the client choosing whether it counted as revenue. Nothing is
 * granted here; the settlement path grants, and only once money arrived.
 *
 * For teams the server requires an org admin: only an admin may commit the firm
 * to a bill.
 */
export async function purchaseCredits(credits: number): Promise<CreditPurchase> {
  const res = await fetch(`${SERVER_URL}/api/practocore/billing/credits/purchase`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ credits }),
  });
  if (!res.ok) throw await billingError(res, `Could not start the purchase (${res.status})`);
  return res.json();
}

/** CheckoutState is the hosted checkout page's view of one invoice. */
export interface CheckoutState {
  number: string;
  status: string;
  currency: string;
  total: string;
  outstanding: string;
  paid: boolean;
  amount_minor: number;
  lines: { description: string; quantity: number; total: string }[];
  methods: string[];
  pending_payment?: { status: string; method: string; redirect_url: string };
}

/**
 * checkoutState polls an invoice's payment state by its checkout token.
 *
 * The token is in the checkout URL, and the route is deliberately
 * unauthenticated — the app polls it after handing the payer off to a browser
 * or an external window, because mobile money completes on the payer's handset
 * where neither we nor the browser can see it.
 */
export async function checkoutState(token: string): Promise<CheckoutState> {
  const res = await fetch(`${SERVER_URL}/api/checkout/${encodeURIComponent(token)}`);
  if (!res.ok) throw await billingError(res, 'This payment link is not valid or has expired');
  return res.json();
}

/** checkoutTokenFromURL pulls the token out of a checkout URL. */
export function checkoutTokenFromURL(url: string): string {
  const m = /\/checkout\/([^/?#]+)/.exec(url);
  return m ? m[1] : '';
}

/**
 * openCheckout hands the payer off to the hosted checkout page.
 *
 * It always leaves the app. That is a store-compliance requirement, not a
 * styling choice: the app stores forbid taking payment for digital goods
 * in-app, and mobile money could not go through their IAP rails in any case.
 *
 * Each platform needs its own door. A Tauri webview's `window.open` returns
 * null without opening anything (the same trap that broke desktop Google
 * sign-in, see services/auth), and a Capacitor WebView would navigate itself
 * away from the running app.
 */
export async function openCheckout(url: string): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }

  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * waitForPayment polls a checkout until it settles, and resolves with whether
 * it did. The page cannot be told: mobile money is confirmed on the payer's
 * handset and lands here as a provider callback, so polling is the only signal
 * the app gets.
 *
 * Resolves false on timeout rather than throwing — a payment that has not
 * arrived yet is not an error, and the invoice stays payable from the billing
 * page either way.
 */
export async function waitForPayment(
  token: string,
  opts: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal } = {},
): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;
  const intervalMs = opts.intervalMs ?? 4_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const state = await checkoutState(token);
      if (state.paid) return true;
    } catch {
      // A transient failure mid-poll should not abandon a payment in flight.
    }
  }
  return false;
}
