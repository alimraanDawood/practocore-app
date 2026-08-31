import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase';

// ---------------------------------------------------------------------------
// ECCMIS import service.
//
// Drives the source-agnostic ingest pipeline: POST /api/practocore/eccmis/sync.
// The endpoint parses an ECCMIS export, previews what it would create/update
// (dryRun), and — on confirm — writes Matters + hearing Deadlines.
//
// Auth: PractoCore custom endpoints expect the RAW token (not "Bearer <token>").
// Two-step safety: the server re-parses + re-plans `content` on commit, so the
// client cannot tamper with the diff between preview and commit. The flow is:
// previewEccmisImport(content) -> show preview -> commitEccmisImport(content).
//
// Types mirror practocore-eccmis/lib/src/types.ts (source of truth).
// ---------------------------------------------------------------------------

export type EccmisSyncFormat = 'json';

/** PractoCore-facing draft produced from an ECCMIS Case. */
export interface MappedMatter {
    caseNumber: string;
    eccmisCaseInstanceId: number;
    status: 'draft' | 'active';
    /** ISO 8601, or null if FilingDate was absent/invalid. */
    filingDate: string | null;
    categoryId: number | null;
    /** null until lookup tables are built — fall back to the id, never show "null". */
    categoryLabel: string | null;
    workflowStateId: number | null;
    workflowStateLabel: string | null;
    assignedJudge: string | null;
    partyInstanceIds: number[];
    /** ISO 8601 of the ECCMIS-side last-update, for staleness checks on re-sync. */
    updatedAt: string | null;
    source: 'eccmis';
}

/** PractoCore-facing draft produced from an ECCMIS CourtSitting (a hearing). */
export interface MappedDeadline {
    name: string;
    /** ISO 8601. */
    dueDate: string;
    /** Hearings are absolute dates, not engine-computed. */
    dependsOn: null;
    eccmisCaseInstanceId: number;
    metadata: {
        courtSittingTypeId: number | null;
        estimatedDuration: number | null;
    };
    source: 'eccmis';
}

export type ImportAction = 'create' | 'update' | 'error';

export interface ImportItem {
    action: ImportAction;
    eccmisCaseNumber: string | null;
    eccmisCaseInstanceId: number | null;
    /** Existing Matters.id when action === "update". */
    matchedMatterId: string | null;
    /** null when action === "error". */
    matter: MappedMatter | null;
    deadlines: MappedDeadline[];
    /** string when action === "error". */
    errorMessage: string | null;
}

export interface ImportSummary {
    toCreate: number;
    toUpdate: number;
    errors: number;
    deadlines: number;
}

export interface ImportPreview {
    summary: ImportSummary;
    items: ImportItem[];
    /** Idempotency key (informational for the UI). */
    contentHash: string;
    source: { kind: 'upload' | 'extension' | 'authorized-server'; label: string };
}

export interface CommitResult {
    dryRun: false;
    importId: string;
    summary: ImportSummary;
    /** Present on a fresh commit. */
    mattersCreated?: number;
    mattersUpdated?: number;
    deadlinesCreated?: number;
    /** true when identical content was already committed — a no-op. */
    alreadyImported?: boolean;
}

const ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/sync`;
const CONNECT_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/connect`;
const STATUS_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/status`;
const FETCH_PREVIEW_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/fetch-preview`;
const IMPORT_SELECTED_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/import-selected`;
const PORTFOLIO_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/portfolio`;
const ATTACH_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/attach`;
const DETACH_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/detach`;
const TIMELINE_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/timeline`;
const PAYMENTS_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/payments`;
const DOCUMENT_ENDPOINT = `${SERVER_URL}/api/practocore/eccmis/document`;

/**
 * The server's own words for a failure, or '' if it sent none.
 *
 * Two response shapes reach here and both have to be read. The ECCMIS routes
 * answer through `apis.NewBadRequestError`, which PocketBase serialises as
 * `{ status, message, data }`; the hand-rolled endpoints elsewhere answer
 * `{ error }`. Reading only `error` — as this did — threw away every message the
 * ECCMIS routes send, which is why a missing connection, a case linked to another
 * matter and a wrong-workspace attach all rendered as the same status code.
 *
 * PocketBase puts per-field validation detail in `data` and leaves the top-level
 * message generic, so fall through to those rather than say "Something went wrong".
 */
function serverMessage(body: any): string {
    const top = [body?.message, body?.error].find((v) => typeof v === 'string' && v.trim());
    const fields = body?.data && typeof body.data === 'object'
        ? Object.values(body.data)
            .map((d: any) => (typeof d?.message === 'string' ? d.message : ''))
            .filter(Boolean)
        : [];
    if (fields.length) return sentence(fields.join(' '));
    return top ? sentence(top) : '';
}

/** Go errors are lowercase and unpunctuated by convention; UI text is neither. */
function sentence(text: string): string {
    const t = text.trim();
    if (!t) return '';
    const capped = t[0].toUpperCase() + t.slice(1);
    return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/**
 * What to say when the server said nothing usable — a gateway timeout, a proxy
 * error, a dropped connection. Named by what the user should do about it, never
 * by the status code alone, and never "import failed": most of these endpoints
 * are not imports.
 */
function statusMessage(status: number): string {
    if (status === 401) return 'Your session has expired. Sign in again.';
    if (status === 403) return 'You do not have access to this case.';
    if (status === 404) return 'That case is no longer in ECCMIS.';
    if (status === 429) return 'Too many requests to ECCMIS. Try again in a minute.';
    if (status >= 500) return 'ECCMIS is not responding right now. Try again shortly.';
    return 'ECCMIS could not complete that request. Try again.';
}

/**
 * Throws an Error carrying the server's own message where there is one, so
 * callers can surface it in a toast or an inline error.
 */
async function parseOrThrow<T>(res: Response): Promise<T> {
    let body: any = null;
    try {
        body = await res.json();
    } catch {
        // No JSON at all (a proxy page, an empty 504) — fall through to status.
    }
    if (!res.ok) {
        throw new Error(serverMessage(body) || statusMessage(res.status));
    }
    return body as T;
}

/**
 * Dry-run: parse + plan the export without writing. Returns the preview the UI
 * renders before the lawyer confirms.
 */
export async function previewEccmisImport(
    content: string,
    format: EccmisSyncFormat = 'json',
): Promise<ImportPreview> {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ content, format }), // dryRun defaults to true (safe)
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    const data = await parseOrThrow<{ dryRun: true; preview: ImportPreview }>(res);
    return data.preview;
}

/**
 * Commit: re-send the SAME content with dryRun:false. The server re-parses and
 * re-plans, then writes inside a transaction. Re-committing identical content is
 * a no-op (alreadyImported: true).
 */
export async function commitEccmisImport(
    content: string,
    format: EccmisSyncFormat = 'json',
): Promise<CommitResult> {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ content, format, dryRun: false }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    return parseOrThrow<CommitResult>(res);
}

// ---------------------------------------------------------------------------
// Option A — Authorized server-side sync (gate cleared 2026-05-24)
// Docs: practocore-eccmis/HANDOFF_OPTION_A.md
// ---------------------------------------------------------------------------

export type EccmisConnectionStatus = 'connected' | 'disconnected' | 'failed' | 'syncing';

export interface EccmisStatus {
    connected: boolean;
    status: EccmisConnectionStatus;
    eccmisUser?: string;
    lastSyncAt?: string | null;
    lastError?: string | null;
    failureCount?: number;
    usageLog?: Record<string, unknown>;
}

export interface ConnectResult {
    status: 'connected';
    eccmisUser: string;
    eccmisUserId: string;
    message: string;
}

export interface ImportSelectedResult {
    mattersCreated: number;
    mattersUpdated: number;
    deadlinesCreated: number;
    errors: string[];
    durationMs: number;
}

// ---- Server-side preview types (mirrors internal/eccmis/types.go) -----------

export interface ServerMappedMatter {
    caseNumber: string;
    eccmisCaseInstanceId: number;
    status: 'draft' | 'active';
    filingDate: string | null;
    assignedJudge: string | null;
}

export interface ServerMappedDeadline {
    name: string;
    dueDate: string;
    eccmisCaseInstanceId: number;
    metadata: Record<string, unknown>;
}

export interface ServerImportItem {
    action: ImportAction;
    eccmisCaseNumber: string | null;
    eccmisCaseInstanceId: number | null;
    matchedMatterId: string | null;
    matter: ServerMappedMatter | null;
    deadlines: ServerMappedDeadline[];
    errorMessage: string | null;
}

export interface ServerImportPreview {
    summary: ImportSummary;
    items: ServerImportItem[];
    contentHash: string;
    source: { kind: string; label: string };
}

/** Store encrypted ECCMIS credentials and test the login live. */
export async function connectEccmis(username: string, password: string): Promise<ConnectResult> {
    const res = await fetch(CONNECT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    return parseOrThrow<ConnectResult>(res);
}

/** Remove stored credentials and disable automated sync. */
export async function disconnectEccmis(): Promise<void> {
    const res = await fetch(CONNECT_ENDPOINT, {
        method: 'DELETE',
        headers: { 'Authorization': pocketbase.authStore.token },
    });
    await parseOrThrow<{ status: string }>(res);
}

/** Returns the current ECCMIS connection state and usage info. */
export async function getEccmisStatus(): Promise<EccmisStatus> {
    const res = await fetch(STATUS_ENDPOINT, {
        headers: { 'Authorization': pocketbase.authStore.token },
    });
    return parseOrThrow<EccmisStatus>(res);
}

/** Fetch a dry-run preview of what ECCMIS would import. Nothing is written. */
export async function fetchEccmisPreview(): Promise<ServerImportPreview> {
    const res = await fetch(FETCH_PREVIEW_ENDPOINT, {
        headers: { 'Authorization': pocketbase.authStore.token },
    });
    return parseOrThrow<ServerImportPreview>(res);
}

/** Import only the selected cases (by case number) from ECCMIS. */
export async function importEccmisSelected(selectedCaseNumbers: string[]): Promise<ImportSelectedResult> {
    const res = await fetch(IMPORT_SELECTED_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ selectedCaseNumbers }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    return parseOrThrow<ImportSelectedResult>(res);
}

// ---- Phase 3: create-in-Practo, attach-to-ECCMIS (read-side link) ----------

/** One case in the advocate's ECCMIS portfolio, for the attach picker. */
export interface PortfolioCase {
    caseInstanceId: number;
    caseNumber: string;
    statusLabel?: string;
    parties?: string[];
    filingDate?: string;
    /** If set, this ECCMIS case is already linked to that local matter. */
    linkedMatterId?: string;
    /** Derived from the case number, e.g. "High Court — Commercial Court". */
    courtName?: string;
    /** Derived from the case number; empty when the code is not a documented one. */
    category?: string;
}

export interface AttachResult {
    matterId: string;
    caseNumber: string;
    deadlinesCreated: number;
}

/** Fetch the advocate's ECCMIS portfolio (annotated with existing links). */
export async function fetchEccmisPortfolio(): Promise<PortfolioCase[]> {
    const res = await fetch(PORTFOLIO_ENDPOINT, {
        headers: { 'Authorization': pocketbase.authStore.token },
    });
    const { cases } = await parseOrThrow<{ cases: PortfolioCase[] }>(res);
    return cases ?? [];
}

/** Link an existing PractoCore matter to an ECCMIS case (read-side only). */
export async function attachEccmisCase(matterId: string, caseInstanceId: number): Promise<AttachResult> {
    const res = await fetch(ATTACH_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ matterId, caseInstanceId }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    return parseOrThrow<AttachResult>(res);
}

/**
 * Remove the ECCMIS link from a matter.
 *
 * `removeHearings` also deletes the hearings the integration imported — the way
 * back from a case attached to the WRONG matter, where keeping another case's
 * diary is the whole problem. It is opt-in because the ordinary unlink (stop the
 * sync on a correctly-attached case) must keep dates the lawyer relies on.
 * Returns how many hearings were actually removed.
 */
export async function detachEccmisCase(matterId: string, removeHearings = false): Promise<number> {
    const res = await fetch(DETACH_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ matterId, removeHearings }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    const out = await parseOrThrow<{ detached: boolean; hearingsRemoved?: number }>(res);
    return out?.hearingsRemoved ?? 0;
}

/**
 * How many rows on this matter came from the court — what the unlink dialog
 * offers to remove. Read straight from the collection: `origin = 'court'` is the
 * same provenance the server deletes on, so the number offered and the number
 * removed cannot disagree.
 */
export async function countEccmisHearings(matterId: string): Promise<number> {
    const page = await pocketbase.collection('Deadlines').getList(1, 1, {
        filter: `matter = "${matterId}" && origin = "court"`,
        fields: 'id',
        skipTotal: false,
    });
    return page.totalItems;
}


// ---------------------------------------------------------------------------
// Live-probe surfaces (2026-08-23): case timeline, court fees, documents.
// ---------------------------------------------------------------------------

/** One stage of a case's life, as the registry recorded it. */
export interface CaseTimelineEntry {
    id: number;
    stateId: number;
    /** Resolved label; empty when the workflow catalogue could not name it. */
    state: string;
    actionId: number;
    action?: string;
    userId?: number;
    /** Resolved officer name; empty rather than a bare id. */
    user?: string;
    startedAt?: string;
    endedAt?: string;
    /** Days the registry recorded for this stage. */
    durationDays?: number;
    current: boolean;
    final: boolean;
    details?: string;
}

export interface CaseDocumentRef {
    documentId: number;
    title?: string;
    addedOn?: string;
}

export interface CaseTimeline {
    caseInstanceId: number;
    caseNumber?: string;
    currentState?: string;
    entries: CaseTimelineEntry[];
    judges?: string[];
    documents?: CaseDocumentRef[];
    /** Total recorded across completed stages — the pace of the case. */
    elapsedDays?: number;
}

/** A mirrored court fee. Amounts are UGX, which is ZERO-DECIMAL — never /100. */
export interface EccmisPaymentRecord {
    id: string;
    matter: string;
    caseInstanceId: number;
    caseNumber: string;
    eccmisPaymentId: string;
    prn: string;
    amount: number;
    currency: string;
    status: 'draft' | 'pending_payment' | 'paid_offline_pending' | 'paid_pending' | 'paid' | 'expired' | 'unknown';
    dueDate: string;
    description: string;
}

/**
 * Read one matter's ECCMIS case history. This is an ON-DEMAND call that hits
 * the court live — fetch it when the user opens the timeline, not on page load
 * for a list of matters.
 */
export async function fetchEccmisTimeline(matterId: string): Promise<CaseTimeline> {
    const res = await fetch(`${TIMELINE_ENDPOINT}/${encodeURIComponent(matterId)}`, {
        headers: { 'Authorization': pocketbase.authStore.token },
    });
    return parseOrThrow<CaseTimeline>(res);
}

/**
 * The mirrored court-fee register. Pass `outstanding` to get only the
 * references that still need dealing with (including expired ones, which
 * block the filing until they are regenerated).
 */
export async function fetchEccmisPayments(
    opts: { matterId?: string; outstanding?: boolean } = {},
): Promise<EccmisPaymentRecord[]> {
    const params = new URLSearchParams();
    if (opts.matterId) params.set('matterId', opts.matterId);
    if (opts.outstanding) params.set('outstanding', 'true');
    const query = params.toString();

    const res = await fetch(query ? `${PAYMENTS_ENDPOINT}?${query}` : PAYMENTS_ENDPOINT, {
        headers: { 'Authorization': pocketbase.authStore.token },
    });
    const { payments } = await parseOrThrow<{ payments: EccmisPaymentRecord[] }>(res);
    return payments ?? [];
}

/**
 * Fetch a court document's bytes.
 *
 * The binary route is the one unsettled question from the live probe — the
 * court's own content endpoint answered 204 with no body for a document whose
 * metadata reads fine. The server tries every published route and, on failure,
 * throws with the exact routes tried and what each answered. Surface that
 * message rather than a generic "download failed": it is the evidence needed to
 * tell a storage gap on the court's side from a route we are calling wrongly.
 */
export async function fetchEccmisDocument(matterId: string, documentId: number): Promise<Blob> {
    const res = await fetch(
        `${DOCUMENT_ENDPOINT}/${documentId}?matterId=${encodeURIComponent(matterId)}`,
        { headers: { 'Authorization': pocketbase.authStore.token } },
    );
    if (!res.ok) {
        let message = `Could not fetch document ${documentId}`;
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            // Non-JSON error body — keep the default.
        }
        throw new Error(message);
    }
    return res.blob();
}
