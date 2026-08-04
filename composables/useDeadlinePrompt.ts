import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

// Registered here rather than relying on the calling component: this composable
// uses fromNow() and tz(), and a caller that had not extended dayjs itself would
// fail at runtime on a deadline that happens to be corrected. extend() is
// idempotent on the shared dayjs singleton.
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/**
 * A deadline's prompt is template prose that cites the rule imposing the step —
 * "File your defence by <<date>> (15 days after service — O.8 r.1(2), SI 77-1)".
 * The date placeholder used to be filled with whatever date the row currently
 * carried, including a CORRECTED one (L2 override).
 *
 * That made the sentence false. A date the registrar gave orally is not a date
 * O.8 r.1(2) produced, and the sentence said it was — in the one place the firm
 * reads to know what the rule requires. The "CORRECTED" badge sat above it
 * saying the opposite.
 *
 * The fix does not hide the rule: hiding it would leave a bare date with no
 * authority at all, which is worse on a litigation file. Instead the rule
 * sentence is rendered against the date the rule ACTUALLY produced, and labelled
 * as the computation rather than as the operative date. The operative date stays
 * where it has always been — the row's own date, badged as corrected.
 */

/** A manual correction of a computed date, as expanded on a deadline record. */
export interface DeadlineCorrection {
  id?: string;
  from: string;
  to?: string;
  reason?: string;
  kind?: string;
  created?: string;
}

/**
 * The most recent correction on a deadline, or null. Returns the row rather than
 * a boolean because `from` — the computed date the correction superseded — is
 * what the rule sentence has to be rendered against.
 *
 * Rows written before the 1784200000 migration carry no `kind` and were all
 * adjournments, so an absent kind must never read as a correction.
 */
export function correctionOf(deadline: any): DeadlineCorrection | null {
  const rows = (deadline?.expand?.adjournments ?? []).filter(
    (a: any) => a?.kind === "override",
  );
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a: any, b: any) =>
      new Date(b.created).getTime() - new Date(a.created).getTime(),
  )[0];
}

interface PromptOptions {
  /** IANA timezone of the reading user, when known. */
  timezone?: string;
}

export interface FormattedPrompt {
  /** The prompt with its placeholders filled. Empty when there is no prompt. */
  html: string;
  /**
   * True when the sentence describes the rule's computation rather than the
   * operative date — i.e. this deadline was corrected. The caller must label it,
   * or the reader will take the computed date for the real one.
   */
  isComputation: boolean;
}

/**
 * Fill a deadline prompt's placeholders.
 *
 * On an ordinary deadline this is the date the row carries, unchanged from
 * before. On a corrected one, EVERY placeholder resolves against the computed
 * date the correction superseded, so the whole sentence stays internally
 * consistent: a rule sentence half about the rule's date and half about the
 * firm's would be harder to read than either.
 */
export function useDeadlinePrompt() {
  const formatDeadlinePrompt = (
    prompt: string | undefined | null,
    date: string,
    deadline?: any,
    opts: PromptOptions = {},
  ): FormattedPrompt => {
    if (!prompt) return { html: "", isComputation: false };

    const correction = deadline ? correctionOf(deadline) : null;
    // The computed date is the one the rule produced; fall back to the row's own
    // date if a correction somehow carries no `from`, so a malformed row degrades
    // to today's behaviour rather than rendering "Invalid Date".
    const effective = correction?.from || date;

    const d = opts.timezone ? dayjs(effective).tz(opts.timezone) : dayjs(effective);
    const html = prompt
      .replace("<<date>>", `<b class="text-foreground">${d.format("D MMM YYYY")}</b>`)
      .replace("<<from_now>>", `<b class="text-foreground">${d.fromNow()}</b>`);

    return { html, isComputation: !!correction };
  };

  return { formatDeadlinePrompt, correctionOf };
}
