// services/billing/gate — the client half of the 402.
//
// The server's request guard refuses a restricted holder with HTTP 402 and a
// `data.billing` payload describing exactly why. Before this, nothing on the
// client read that payload, so a blocked request surfaced as whatever generic
// "request failed" message happened to be nearest — the user was stopped
// without ever being told they had been stopped, or why.
//
// This module is deliberately a plain Vue ref rather than a Nuxt `useState`:
// it is written to from `lib/pocketbase.ts`, which is imported outside any Nuxt
// context (plugins, middleware, bare service modules). The app runs SSR-off, so
// a module-scoped ref is a safe singleton.

import { ref, readonly } from 'vue';

/** BillingBlock is the `data.billing` payload the guard attaches to its 402. */
export interface BillingBlock {
  level: 'read_only' | 'locked' | string;
  reason: string;
  /** The capability the refused request needed: read, write, ai or export. */
  required: string;
  term_end: string | null;
  grace_end: string | null;
  read_only_end: string | null;
  days_remaining: number;
  is_trial: boolean;
  /** The server's own explanation. It names the actual state, so it is shown verbatim. */
  message: string;
}

const current = ref<BillingBlock | null>(null);

/** blockedByBilling is the most recent 402, or null. Read by the UI. */
export const blockedByBilling = readonly(current);

/**
 * reportBillingBlock records a 402 so the UI can explain it.
 *
 * `body` is the parsed error response. Anything that is not a recognisable
 * billing refusal is ignored: the AI credit gate also answers 402, and a
 * "you're out of credits" is not "your subscription lapsed".
 */
export function reportBillingBlock(body: any): boolean {
  const billing = body?.data?.billing;
  if (!billing || typeof billing.level !== 'string') return false;

  current.value = {
    level: billing.level,
    reason: billing.reason ?? '',
    required: billing.required ?? '',
    term_end: billing.term_end ?? null,
    grace_end: billing.grace_end ?? null,
    read_only_end: billing.read_only_end ?? null,
    days_remaining: billing.days_remaining ?? 0,
    is_trial: !!billing.is_trial,
    message: body?.message || 'A current subscription is required to continue.',
  };
  return true;
}

/** clearBillingBlock dismisses the current refusal. */
export function clearBillingBlock() {
  current.value = null;
}
