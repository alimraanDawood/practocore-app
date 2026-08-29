/**
 * splitFieldLabel separates an authored field label into the question it asks and
 * the justification that follows it.
 *
 * Litigation procedures are authored by lawyers, and a label routinely carries
 * both the ask and the rule it comes from in one string:
 *
 *   "On what date was the employee terminated or summarily dismissed (the act
 *    complained of)? The three-month limitation for the labour-officer complaint
 *    runs from this date, not from any internal-appeal outcome (Employment Act
 *    s.71(2))."
 *
 * Rendered whole, that is a three-line label above a date picker. Split, it is a
 * question with its authority in muted text underneath — which is how the
 * engagement side already reads.
 *
 * This is a presentation heuristic, not a data change: nothing is rewritten and
 * the full authored text always survives (question + hint concatenates back).
 * When no confident split exists the whole label is returned as the question,
 * which is exactly today's behaviour.
 */

// Tokens that end in a full stop without ending a sentence. Statutory citations
// are the common case here — splitting inside "Employment Act s.71(2)." would
// strand the authority away from the rule it supports.
const ABBREVIATIONS = new Set([
  's', 'ss', 'r', 'rr', 'art', 'arts', 'no', 'nos', 'cap', 'para', 'paras',
  'reg', 'regs', 'sched', 'sch', 'ch', 'cl', 'ord', 'o', 'vol', 'p', 'pp',
  'eg', 'ie', 'etc', 'cf', 'v', 'vs', 'ltd', 'co', 'mr', 'mrs', 'ms', 'dr',
  'hon', 'j', 'ja', 'jsc', 'ug', 'uglc', 'ughc', 'ugca', 'ugsc',
]);

// Below this a label is already short enough to read as one line; splitting it
// only scatters it across two type sizes.
const MIN_LENGTH_TO_SPLIT = 90;

// A fragment shorter than this on either side is noise, not a sentence — a bare
// "Yes." tail or a two-word "Why?" stem reads worse split than whole.
const MIN_FRAGMENT = 12;

export interface SplitLabel {
  /** The question to show as the control's label. Never empty. */
  label: string;
  /** The justification to show as muted helper text, or '' when there is none. */
  hint: string;
}

export function splitFieldLabel(raw: string | undefined | null): SplitLabel {
  const text = (raw ?? '').trim();
  if (text.length < MIN_LENGTH_TO_SPLIT) return { label: text, hint: '' };

  const at = firstSentenceEnd(text);
  if (at < 0) return { label: text, hint: '' };

  const label = text.slice(0, at + 1).trim();
  const hint = text.slice(at + 1).trim();
  if (label.length < MIN_FRAGMENT || hint.length < MIN_FRAGMENT) {
    return { label: text, hint: '' };
  }
  return { label, hint };
}

/**
 * Index of the terminator that ends the first sentence, or -1.
 *
 * A question mark ends a sentence unconditionally — a label that contains one is
 * a question with commentary after it, which is the shape this exists for. A
 * full stop only counts when it is not an abbreviation and the next sentence
 * visibly begins (whitespace then a capital letter or a digit).
 */
function firstSentenceEnd(text: string): number {
  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i];
    if (ch === '?') return i;
    if (ch !== '.') continue;
    if (isAbbreviation(text, i)) continue;
    if (!/^\s+["'“(]?[A-Z0-9]/.test(text.slice(i + 1))) continue;
    return i;
  }
  return -1;
}

// True when the full stop at `i` closes an abbreviation or a numbered citation
// ("s.71", "No. 4", "e.g.") rather than a sentence.
function isAbbreviation(text: string, i: number): boolean {
  const before = text.slice(0, i);
  // "s.71(2)." — the stop after a citation's closing bracket still belongs to it
  // only if the citation itself was an abbreviation, so look past the brackets.
  const word = (before.match(/([A-Za-z]+)[\d()\[\]\s]*$/)?.[1] ?? '').toLowerCase();
  if (word && ABBREVIATIONS.has(word)) return true;
  // A single letter or a bare number before the stop is an initial or a list
  // marker, never the end of a sentence.
  return /(^|[\s(])[A-Za-z0-9]\.$/.test(before + '.');
}
