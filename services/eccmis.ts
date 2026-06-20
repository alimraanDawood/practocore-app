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

/**
 * Throws an Error carrying the server's `error` string (or a status fallback)
 * so callers can surface it in a toast.
 */
async function parseOrThrow<T>(res: Response): Promise<T> {
    let body: any = null;
    try {
        body = await res.json();
    } catch {
        // fall through to status-based error below
    }
    if (!res.ok) {
        throw new Error(body?.error || `ECCMIS import failed (${res.status}).`);
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

/** Remove the ECCMIS link from a matter (keeps already-imported hearings). */
export async function detachEccmisCase(matterId: string): Promise<void> {
    const res = await fetch(DETACH_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ matterId }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
    });
    await parseOrThrow<{ detached: boolean }>(res);
}
