// Office.js bridge for the Word add-in routes (pages/word/*). Everything that touches
// Office.js or the open Word document lives here so the rest of the app stays
// transport-agnostic. Ported from the standalone practocore-word-addin (src/word.ts)
// as part of folding the add-in into this codebase — see pages/word/taskpane.vue.
//
// SPIKE NOTE: this is enough to prove the /word/taskpane route runs the shared
// <ChatSurface> inside Word and can write the AI's output back into the document.
// The Office globals are loosely typed via types/office.d.ts.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ── Office.js bootstrap ────────────────────────────────────────────────────────
// Office add-ins load Office.js from Microsoft's CDN and gate all work on
// Office.onReady. In a Nuxt SPA the task pane is just a route, so we inject the
// script on demand (once) and resolve with the host once Office is ready.
let officeReady: Promise<{ host: string }> | null = null;

const OFFICE_JS = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';

export function ensureOffice(): Promise<{ host: string }> {
  if (officeReady) return officeReady;
  officeReady = new Promise((resolve, reject) => {
    const start = () => {
      try {
        Office.onReady((info: any) => resolve({ host: String(info?.host ?? '') }));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Office.onReady failed'));
      }
    };
    if (typeof (window as any).Office !== 'undefined') { start(); return; }
    const s = document.createElement('script');
    s.src = OFFICE_JS;
    s.async = true;
    s.onload = start;
    s.onerror = () => reject(new Error('Failed to load Office.js — open this page inside Microsoft Word.'));
    document.head.appendChild(s);
  });
  return officeReady;
}

/** True when running inside the Word host (vs. a plain browser tab). */
export function isWordHost(host: string): boolean {
  return host === (Office?.HostType?.Word ?? 'Word') || host === 'Word';
}

// ── Markdown → HTML (sanitised) ────────────────────────────────────────────────
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return DOMPurify.sanitize(html);
}

// ── Document writes ─────────────────────────────────────────────────────────────
// Drop an HTML fragment into the document and let Word map it to native styles.
// Optionally wrapped in tracked changes so every AI edit is a reviewable suggestion
// (the legal-drafting default). Batched into one Word.run so undo is a single step.
async function insertHtmlTracked(html: string, mode: 'insert' | 'replace', tracked: boolean): Promise<void> {
  await Word.run(async (context: any) => {
    const doc = context.document as any;
    const canTrack = Office.context.requirements.isSetSupported('WordApi', '1.4');
    let prior: string | undefined;
    if (tracked && canTrack) {
      doc.load('changeTrackingMode');
      await context.sync();
      prior = doc.changeTrackingMode;
      doc.changeTrackingMode = 'TrackAll';
    }

    const sel = context.document.getSelection();
    sel.insertHtml(html, mode === 'replace' ? Word.InsertLocation.replace : Word.InsertLocation.after);
    await context.sync();

    if (tracked && canTrack && prior && prior !== 'TrackAll') {
      doc.changeTrackingMode = prior;
      await context.sync();
    }
  });
}

/** Insert Markdown into the document with real Word formatting, as a tracked change. */
export async function insertMarkdown(md: string, mode: 'insert' | 'replace' = 'insert', tracked = true): Promise<void> {
  await insertHtmlTracked(renderMarkdown(md), mode, tracked);
}

/** The user's current selection as plain text (empty string if nothing selected). */
export async function getSelectionText(): Promise<string> {
  return Word.run(async (context: any) => {
    const sel = context.document.getSelection();
    sel.load('text');
    await context.sync();
    return sel.text ?? '';
  });
}

/** The whole document body as plain text — the input to a cite-check pass. */
export async function getDocumentText(): Promise<string> {
  return Word.run(async (context: any) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    return body.text ?? '';
  });
}

// ── Cite-check: comment + jump ──────────────────────────────────────────────────
export interface CiteComment {
  /** Exact text to locate in the document. */
  raw: string;
  /** Comment body to attach at that location. */
  note: string;
}

/** Find each `raw` string in the document and attach a Word comment with its note.
 *  Used by cite-check to flag unverifiable citations inline. Returns the number of
 *  matches actually commented (a citation the search can't relocate is skipped).
 *  Requires WordApi 1.4 (comments); older hosts get a no-op + 0. */
export async function commentOnMatches(items: CiteComment[]): Promise<number> {
  if (!items.length) return 0;
  const canComment = Office.context.requirements.isSetSupported('WordApi', '1.4');
  if (!canComment) return 0;
  return Word.run(async (context: any) => {
    let commented = 0;
    for (const item of items) {
      const needle = (item.raw ?? '').trim();
      if (!needle) continue;
      // Word search caps the query length; long citations are rare but guard anyway.
      const results = context.document.body.search(needle.slice(0, 255), { matchCase: false });
      results.load('items');
      await context.sync();
      if (results.items.length > 0) {
        results.items[0].insertComment(item.note);
        commented += 1;
      }
    }
    await context.sync();
    return commented;
  });
}

/** Scroll to and select the first occurrence of `raw` so the user can see the
 *  citation in context. No-op if it can't be found. */
export async function jumpToText(raw: string): Promise<boolean> {
  const needle = (raw ?? '').trim();
  if (!needle) return false;
  return Word.run(async (context: any) => {
    const results = context.document.body.search(needle.slice(0, 255), { matchCase: false });
    results.load('items');
    await context.sync();
    if (results.items.length === 0) return false;
    const range = results.items[0];
    range.select();
    range.scrollIntoView?.();
    await context.sync();
    return true;
  });
}

/** Subscribe to selection changes. Fires once immediately, then on every change.
 *  Returns an unsubscribe fn. */
export function onSelectionChanged(cb: (text: string) => void): () => void {
  const handler = async () => {
    try { cb(await getSelectionText()); } catch { cb(''); }
  };
  Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, handler);
  void handler();
  return () => {
    Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler });
  };
}

// ── Document IR → Word ─────────────────────────────────────────────────────────
// The generate_document tool's input IS the structured Document IR (the model emits
// it directly — see practocore-backend/ai/docgen/ir.go). In Word we pour the IR
// straight onto the page as native, editable paragraphs rather than downloading a
// .docx. Tolerant of snake_case (raw tool input) or camelCase.
function pick<T = any>(o: any, ...keys: string[]): T | undefined {
  for (const k of keys) if (o && o[k] != null) return o[k] as T;
  return undefined;
}
function esc(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}
function multiline(s: string): string {
  return s.replace(/\\r\\n|\\n|\r\n|\n/g, '\n').split('\n').map(esc).join('<br>');
}

function irToHtml(raw: any): string {
  const parts: string[] = [];
  const center = (s?: string) => { if (s) parts.push(`<p style="text-align:center">${esc(s)}</p>`); };

  const draftNotice = pick<string>(raw, 'draftNotice', 'draft_notice');
  if (draftNotice) parts.push(`<p style="text-align:center"><em>${esc(draftNotice)}</em></p>`);

  const ch = pick<any>(raw, 'courtHeading', 'court_heading');
  if (ch) {
    center(pick(ch, 'court'));
    center(pick(ch, 'division'));
    const cause = [pick<string>(ch, 'causeType', 'cause_type'), pick<string>(ch, 'causeNumber', 'cause_number')]
      .filter(Boolean).join(' No. ');
    if (cause) center(cause);
    center(pick(ch, 'inTheMatterOf', 'in_the_matter_of'));
    for (const pt of (pick<any[]>(ch, 'parties') ?? [])) {
      const line = [pick<string>(pt, 'name'), pick<string>(pt, 'role')].filter(Boolean).join(' — ');
      center(line);
    }
  }

  const title = pick<string>(raw, 'title');
  if (title) parts.push(`<h1 style="text-align:center">${esc(title)}</h1>`);

  let n = 0;
  for (const s of (pick<any[]>(raw, 'sections') ?? [])) {
    const heading = pick<string>(s, 'heading');
    if (heading) parts.push(`<h2>${esc(heading)}</h2>`);
    const numbered = pick<boolean>(s, 'numbered');
    for (const para of (pick<string[]>(s, 'paragraphs') ?? [])) {
      if (numbered) { n += 1; parts.push(`<p>${n}. ${esc(para)}</p>`); }
      else parts.push(`<p>${esc(para)}</p>`);
    }
  }

  const prayer = pick<string[]>(raw, 'prayer') ?? [];
  if (prayer.length) {
    parts.push('<p><strong>PRAYER</strong></p>');
    prayer.forEach((p, i) => parts.push(`<p>${String.fromCharCode(97 + i)}) ${esc(p)}</p>`));
  }

  const sig = pick<string>(raw, 'signatureBlock', 'signature_block');
  if (sig) parts.push(`<p>&nbsp;</p><p>${multiline(sig)}</p>`);

  return parts.join('');
}

export async function insertDocumentIr(raw: any): Promise<void> {
  await insertHtmlTracked(irToHtml(raw), 'insert', true);
}
