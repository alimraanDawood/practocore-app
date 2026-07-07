import PocketBase from 'pocketbase';
import { pb, SERVER_URL } from '~/lib/pocketbase';

// ── Case-law corpus service ─────────────────────────────────────────────────
// Surfaces the Ugandan case-law corpus (practocore-backend/ai/caselaw) to the
// hidden superuser admin UI. Curation (upload/delete/reindex) is superuser-only on
// the backend, so those calls go through a SEPARATE PocketBase client authenticated
// against the `_superusers` collection — the app's main session is a normal Users
// session and must stay intact for navigation. Reads (list/get) are open to any
// authenticated user and use the main token.

export type CaseLawStatus = 'pending' | 'processing' | 'ingested' | 'failed' | 'needs_review';

export interface CaseLawSource {
  id: string;
  // Stable, deployment-independent id (ULII mirror key stem). A future centralized
  // corpus service resolves content by this; today the local `id` is what's fetched.
  global_id?: string;
  has_pdf?: boolean;      // an original PDF is available to view/download
  has_markdown?: boolean; // AI-readable markdown is stored
  type: string;
  citation: string;
  title: string;
  court: string;
  case_number: string;
  decision_date: string; // YYYY-MM-DD or ""
  subjects: string[];
  headnote: string;
  status: CaseLawStatus;
  provisions_count: number;
  ocr: boolean;
  source_url: string;
  error: string;
  created: string;
}

export interface CaseLawParagraph {
  id: string;
  anchor: string;
  text: string;
  derived_summary?: string;
}

export interface CaseLawHolding {
  statement: string;
  anchors: string[];
}

export interface CaseLawDetail extends CaseLawSource {
  paragraphs: CaseLawParagraph[];
  holdings: CaseLawHolding[] | null;
  file: string;
  collectionId: string;
}

// Known Ugandan court codes for the filter + upload override.
export const UG_COURTS: { value: string; label: string }[] = [
  { value: 'UGSC', label: 'Supreme Court' },
  { value: 'UGCA', label: 'Court of Appeal' },
  { value: 'UGCC', label: 'Constitutional Court' },
  { value: 'UGHCCD', label: 'High Court — Civil' },
  { value: 'UGHCCRD', label: 'High Court — Criminal' },
  { value: 'UGHCLD', label: 'High Court — Land' },
  { value: 'UGHCCOMC', label: 'High Court — Commercial' },
  { value: 'UGHCFD', label: 'High Court — Family' },
];

export function courtLabel(code: string): string {
  return UG_COURTS.find((c) => c.value === code)?.label || code || 'Unknown court';
}

// ── Superuser session (separate client) ─────────────────────────────────────
// A dedicated client so signing in as a superuser never clobbers the app's Users
// session. authStore persists in localStorage under a distinct key so the admin
// stays signed in across reloads.
const adminPb = new PocketBase(SERVER_URL);
adminPb.autoCancellation(false);
if (typeof window !== 'undefined') {
  // Persist the superuser auth separately from the app session.
  const KEY = 'pc_caselaw_admin_auth';
  const saved = window.localStorage.getItem(KEY);
  if (saved) {
    try {
      const { token, record } = JSON.parse(saved);
      adminPb.authStore.save(token, record);
    } catch { /* ignore */ }
  }
  adminPb.authStore.onChange(() => {
    if (adminPb.authStore.isValid) {
      window.localStorage.setItem(KEY, JSON.stringify({
        token: adminPb.authStore.token,
        record: adminPb.authStore.record,
      }));
    } else {
      window.localStorage.removeItem(KEY);
    }
  });
}

export function isSuperuserSignedIn(): boolean {
  return adminPb.authStore.isValid && adminPb.authStore.record?.collectionName === '_superusers';
}

export async function superuserLogin(email: string, password: string): Promise<void> {
  await adminPb.collection('_superusers').authWithPassword(email, password);
  if (!isSuperuserSignedIn()) {
    adminPb.authStore.clear();
    throw new Error('Not a superuser account.');
  }
}

export function superuserLogout(): void {
  adminPb.authStore.clear();
}

/** The current superuser auth token, for other admin surfaces (e.g. the Help
 *  curator) that share this single `_superusers` session. "" when not signed in. */
export function superuserToken(): string {
  return adminPb.authStore.token || '';
}

// ── Reads (any authenticated user) ──────────────────────────────────────────

export interface ListFilters {
  court?: string;
  year?: string;
  status?: CaseLawStatus | '';
  q?: string;
}

export async function listSources(filters: ListFilters = {}): Promise<CaseLawSource[]> {
  const qs = new URLSearchParams();
  if (filters.court) qs.set('court', filters.court);
  if (filters.year) qs.set('year', filters.year);
  if (filters.status) qs.set('status', filters.status);
  if (filters.q) qs.set('q', filters.q);
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sources?${qs.toString()}`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  const j = await res.json();
  return j.results || [];
}

export async function getSource(id: string): Promise<CaseLawDetail> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sources/${id}`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error(`Load failed (${res.status})`);
  return res.json();
}

/** Tokenised URL to the original judgment file (for preview/download). */
export async function sourceFileUrl(detail: CaseLawDetail): Promise<string> {
  if (!detail.file) return '';
  const token = await pb.files.getToken();
  return `${SERVER_URL}/api/files/${detail.collectionId}/${detail.id}/${detail.file}?token=${token}`;
}

// ── User-facing reader (citation drill-down) ─────────────────────────────────
// These use the normal Users token — the corpus is a global, read-only authority axis
// any authed user can read. Endpoints are shaped as the content API a future centralized
// corpus service will expose, so the same calls can later re-point at that service.

export interface CaseLawMarkdown {
  id: string;
  global_id: string;
  citation: string;
  title: string;
  court: string;
  markdown: string;
}

/** The AI-readable markdown for a source (the in-app reader's raw view). */
export async function getCaseLawMarkdown(id: string): Promise<CaseLawMarkdown> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sources/${id}/markdown`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error(`Markdown unavailable (${res.status})`);
  return res.json();
}

/**
 * Fetches the original PDF (streamed from the mirror) and returns an object URL for an
 * <iframe>/<a>. The endpoint is header-authenticated, so we fetch as a blob rather than
 * linking directly. Caller must URL.revokeObjectURL when done.
 */
export async function caseLawPdfObjectUrl(id: string, download = false): Promise<string> {
  const q = download ? '?download=1' : '';
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sources/${id}/pdf${q}`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error(`PDF unavailable (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

// ── Writes (superuser only) ─────────────────────────────────────────────────

export interface UploadOverrides {
  citation?: string;
  court?: string;
  title?: string;
  source_url?: string;
}

export function uploadJudgment(
  file: File,
  overrides: UploadOverrides = {},
  onProgress?: (pct: number) => void,
): Promise<{ id: string; status: string; citation: string; title: string; message: string }> {
  return new Promise((resolve, reject) => {
    if (!isSuperuserSignedIn()) {
      reject(new Error('Sign in as a superuser to upload.'));
      return;
    }
    const form = new FormData();
    form.append('file', file);
    if (overrides.citation) form.append('citation', overrides.citation);
    if (overrides.court) form.append('court', overrides.court);
    if (overrides.title) form.append('title', overrides.title);
    if (overrides.source_url) form.append('source_url', overrides.source_url);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SERVER_URL}/api/practocore/ai/caselaw/upload`);
    xhr.setRequestHeader('Authorization', adminPb.authStore.token);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* noop */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.send(form);
  });
}

export async function deleteSource(id: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sources/${id}`, {
    method: 'DELETE',
    headers: { Authorization: adminPb.authStore.token },
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

export async function reindex(): Promise<{ fts_indexed: number; embedded: number }> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/reindex`, {
    method: 'POST',
    headers: { Authorization: adminPb.authStore.token },
  });
  if (!res.ok) throw new Error(`Reindex failed (${res.status})`);
  return res.json();
}

// ── Harvester → corpus catalogue sync (superuser) ───────────────────────────
// The incremental bridge that ingests judgments the harvester mirrored to S3,
// WITHOUT storing the PDFs here (see practocore-backend/ai/corpus/catalogue.go).
// A court-priority × newest-year-first sweep, self-paced by the ingestion backlog,
// with an operator on/off toggle. These endpoints are 404 unless the backend has
// the harvester link configured (HARVESTER_URL + creds).

export interface CatalogueSyncStatus {
  enabled: boolean;
  phase: 'not started' | 'backfill' | 'other courts' | 'tail' | string;
  court: string;
  year: string;
  imported: number;
  skipped: number;
  last_error: string;
  last_run: string;
  imported_now?: number;
  /** false when the backend returned 404 (bridge not configured). */
  configured?: boolean;
}

export async function getCatalogueSync(): Promise<CatalogueSyncStatus> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sync-catalogue`, {
    headers: { Authorization: adminPb.authStore.token },
  });
  if (res.status === 404) {
    return { enabled: false, phase: 'not started', court: '', year: '', imported: 0, skipped: 0, last_error: '', last_run: '', configured: false };
  }
  if (!res.ok) throw new Error(`Sync status failed (${res.status})`);
  return { ...(await res.json()), configured: true };
}

export async function toggleCatalogueSync(enabled: boolean): Promise<CatalogueSyncStatus> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sync-catalogue/toggle`, {
    method: 'POST',
    headers: { Authorization: adminPb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`Toggle failed (${res.status})`);
  return { ...(await res.json()), configured: true };
}

export async function runCatalogueSync(): Promise<CatalogueSyncStatus> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/caselaw/sync-catalogue/run`, {
    method: 'POST',
    headers: { Authorization: adminPb.authStore.token },
  });
  if (!res.ok) throw new Error(`Sync run failed (${res.status})`);
  return { ...(await res.json()), configured: true };
}

/**
 * Backfill/refresh the semantic vectors on AiMemories (vault facts, recalled
 * memories). Superuser-only — run once after provisioning or changing the
 * embedder (e.g. fixing the Voyage key) so existing memories become semantically
 * searchable. Distinct from {@link reindex}, which covers the case-law corpus.
 */
export async function reindexMemoryEmbeddings(): Promise<{ embedded: number }> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/memory/reindex-embeddings`, {
    method: 'POST',
    headers: { Authorization: adminPb.authStore.token },
  });
  if (!res.ok) throw new Error(`Memory reindex failed (${res.status})`);
  return res.json();
}
