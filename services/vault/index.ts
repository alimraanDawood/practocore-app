import { pb, SERVER_URL } from '~/lib/pocketbase';
import { track } from '~/utils/analytics';

// ── Vault service ───────────────────────────────────────────────────────────
// Surfaces the AI Vault (practocore-backend/ai/vault) to the frontend. A vault is
// a *source* that distils uploaded case documents into provenance-backed memories;
// here we manage the document/folder organisation layer and watch ingestion live.
//
// Reads (list + realtime) go straight through the PocketBase SDK because the
// AiVaultDocuments / AiVaultFolders collections expose org-scoped list/view rules.
// Writes (upload, folder CRUD, delete) go through gated custom endpoints under
// /api/practocore/ai/vault/* so the Vaults entitlement + scope access are enforced
// server-side. Auth header is the raw token (no "Bearer" prefix), matching the
// rest of the custom API surface.

// 'vault' is a custom, membership-scoped vault (VAULTS_CUSTOM_STRATEGY.md); its
// scope_id is the AiVaults id. matter/org are the original case/firm libraries.
// 'engagement' is the non-litigation matter type's document library
// (FLEXIBLE_MATTERS_STRATEGY.md), its scope_id is the Engagements id.
export type VaultScope = 'matter' | 'org' | 'vault' | 'user' | 'engagement';

// Mirrors ai/vault/collection.go status lifecycle. 'stored' = kept but AI
// ingestion was deliberately turned off (not read into the knowledge base).
export type VaultStatus = 'pending' | 'processing' | 'ingested' | 'failed' | 'stored';

// Document classification offered at upload (mirrors ai/vault DocType* consts).
export const VAULT_DOC_TYPES = [
  { value: 'case_document', label: 'Case document' },
  { value: 'court_transcript', label: 'Court transcript' },
  { value: 'other', label: 'Other' },
] as const;

export function docTypeLabel(value?: string): string {
  return VAULT_DOC_TYPES.find((t) => t.value === value)?.label || 'Document';
}

export interface VaultFolder {
  id: string;
  org: string;
  scope: VaultScope;
  scope_id: string;
  /** Parent folder id, or "" for a root folder. */
  parent: string;
  name: string;
  /** Soft-delete flag — true means the folder is in the Trash. */
  trashed?: boolean;
  trashed_at?: string;
  created: string;
  updated: string;
}

export interface VaultDocument {
  id: string;
  collectionId?: string;
  collectionName?: string;
  org: string;
  scope: VaultScope;
  scope_id: string;
  /** Owning folder id, or "" for the library root. */
  folder: string;
  /** Classification chosen at upload (case_document / court_transcript / other). */
  doc_type?: string;
  /** Whether the AI was asked to read + distil this document into the KB. */
  ingest?: boolean;
  file: string;
  filename: string;
  mime: string;
  /** Byte size of the stored file, recorded at upload. 0 on rows that predate it. */
  size?: number;
  status: VaultStatus;
  facts_count: number;
  /** True when the text was recovered by OCR (a scanned/image PDF) rather than extracted. */
  ocr?: boolean;
  provider: string;
  error: string;
  /**
   * Per-document access overrides. Absent/empty inherits the library policy;
   * each named axis narrows it. Only allow/deny, only these three keys.
   */
  restrictions?: Partial<Record<VaultAccessAxis, VaultAccessSetting>>;
  /** Soft-delete flag — true means the document is in the Trash. */
  trashed?: boolean;
  trashed_at?: string;
  created_by: string;
  created: string;
  updated: string;
}

export interface Entitlements {
  memory: boolean;
  skills: boolean;
  vaults: boolean;
  documents: boolean;
  modelCeiling: string;
  aiProviders?: AIProviderState;
}

/**
 * Vendor ids, mirroring ai/catalogue.go. A vendor is the COMPANY that processes
 * the tokens — the unit a firm permits or refuses. It is deliberately not the
 * gateway we route through: permitting a router would tell a partner nothing about
 * where privileged client material actually lands.
 *
 * Typed loosely because the catalogue is server-owned: a deployment that adds a
 * vendor must not need an app release before it can be shown.
 */
export type AIProvider = string;

/** One selectable model within a vendor. */
export interface AIModel {
  id: string;
  label: string;
  note: string;
  context: number;
  vision: boolean;
  /** Task slots this model may be assigned to. */
  tasks: string[];
  /** Indicative USD per 1M tokens. Not a bill — the meter uses reported cost. */
  usdIn: number;
  usdOut: number;
}

/** A vendor and the models this deployment can reach from it. */
export interface AIVendor {
  id: AIProvider;
  name: string;
  company: string;
  country: string;
  note: string;
  models: AIModel[];
}

/**
 * One assignable kind of work (ai/tasks.go), carrying everything the settings
 * screen needs to render it: which models may be chosen, what the firm and the
 * member have each set, and which one actually wins.
 */
export interface AITaskState {
  id: string;
  label: string;
  note: string;
  /** Catalogue model id used when nothing is assigned. Always a Claude model. */
  default: string;
  /** Model ids assignable to this task for this firm. */
  options: string[];
  /** What the firm assigned, if anything. */
  firm?: string;
  /** What this member assigned, if anything. */
  member?: string;
  /** What will actually serve this task right now. */
  resolved: string;
  /** 'member', 'firm', or '' when it fell through to the default. */
  by: '' | 'member' | 'firm';
  /**
   * False while no code path consults this slot yet. Reported so the UI can say
   * so plainly: an assignment that is silently ignored is worse than no setting.
   */
  wired?: boolean;
}

/**
 * The layers that decide which model serves a member's work (see ai/router.go
 * providerChoice and ai/tasks.go resolveTask):
 *   available - VENDORS this DEPLOYMENT can reach; nothing to choose if length < 2
 *   allowed   - what the FIRM permits (a confidentiality decision, admin-set)
 *   preferred - the member's coarse vendor pick; '' means follow the firm default
 *   catalogue - the reachable vendors with their models
 *   tasks     - per-task assignment, the "advanced mode" layer
 */
export interface AIProviderState {
  available: AIProvider[];
  allowed: AIProvider[];
  preferred: AIProvider | '';
  catalogue?: AIVendor[];
  tasks?: AITaskState[];
  /**
   * Whether this caller may change the FIRM's permitted vendors — true for an org
   * admin, and for a solo practitioner (their own firm). Server-computed: admin
   * status is a permission question, not something to re-derive in the browser.
   */
  canManage?: boolean;
}

/** Fallback display metadata, used only for a vendor the server did not describe
 *  (an older backend that predates the catalogue). The live catalogue is
 *  authoritative: jurisdiction is stated as fact, once, by the server, and the UI
 *  does not repeat it or add a verdict on top. */
export const AI_PROVIDER_INFO: Record<string, { name: string; vendor: string; note: string }> = {
  claude: {
    name: 'Claude',
    vendor: 'Anthropic',
    note: 'The default. Processed by Anthropic, in the United States.',
  },
  deepseek: {
    name: 'DeepSeek',
    vendor: 'DeepSeek',
    note: 'Lower cost per request. Processed by DeepSeek, in China.',
  },
};

// ── Custom vaults (membership-scoped) ────────────────────────────────────────
// Mirrors ai/vault/vaults.go. A custom vault is a named container with members;
// its documents live in the same AiVaultDocuments/AiVaultFolders collections with
// scope='vault', scope_id=<vault id>.

export const VAULT_ROLES = ['owner', 'manager', 'contributor', 'viewer'] as const;
export type VaultRole = (typeof VAULT_ROLES)[number];

export const VAULT_CAPS = [
  'view', 'download', 'query', 'add_files', 'remove_files', 'manage_folders',
  'toggle_ai', 'invite', 'manage_permissions', 'delete_vault',
] as const;
export type VaultCap = (typeof VAULT_CAPS)[number];

export interface Vault {
  id: string;
  collectionId?: string;
  org: string;
  name: string;
  description: string;
  owner: string;
  created_by: string;
  visibility: 'personal' | 'shared';
  ai_read_default: boolean;
  trashed?: boolean;
  trashed_at?: string;
  created: string;
  updated: string;
}

export interface VaultMember {
  id: string;
  vault: string;
  user: string;
  org: string;
  role: VaultRole;
  /** Per-member capability overrides on top of the role preset. */
  caps?: Record<string, boolean>;
  status: 'invited' | 'active';
  invited_by: string;
  created: string;
  updated: string;
}

// Role → default capability bundle (mirrors ai/vault/vaults.go RolePresets). The
// owner is handled separately (always every capability).
const ROLE_PRESETS: Record<string, Partial<Record<VaultCap, boolean>>> = {
  manager: {
    view: true, download: true, query: true,
    add_files: true, remove_files: true, manage_folders: true,
    toggle_ai: true, invite: true, manage_permissions: true,
  },
  contributor: {
    view: true, download: true, query: true,
    add_files: true, remove_files: true, manage_folders: true,
  },
  // A viewer reads in the app and lets the assistant read for them, but does not
  // take copies away. Grant `download` as a per-member override to change that.
  viewer: { view: true, query: true },
};

/** Resolve a member's effective capabilities (role preset + per-member overrides). */
export function effectiveCaps(role: string, overrides?: Record<string, boolean>): Record<VaultCap, boolean> {
  const out = {} as Record<VaultCap, boolean>;
  for (const c of VAULT_CAPS) out[c] = false;
  if (role === 'owner') {
    for (const c of VAULT_CAPS) out[c] = true;
    return out;
  }
  Object.assign(out, ROLE_PRESETS[role] || {});
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (k === 'delete_vault') continue; // never grantable to a non-owner
      if ((VAULT_CAPS as readonly string[]).includes(k)) out[k as VaultCap] = v;
    }
  }
  return out;
}

export function hasCap(role: string, overrides: Record<string, boolean> | undefined, cap: VaultCap): boolean {
  return !!effectiveCaps(role, overrides)[cap];
}

export const ROLE_LABELS: Record<VaultRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

const DOCS = 'AiVaultDocuments';
const FOLDERS = 'AiVaultFolders';
const VAULTS = 'AiVaults';
const MEMBERS = 'AiVaultMembers';

function scopeFilter(scope: VaultScope, scopeId: string): string {
  return pb.filter('scope = {:scope} && scope_id = {:scopeId}', { scope, scopeId });
}

// ── Reads (PocketBase SDK) ──────────────────────────────────────────────────

export function listFolders(scope: VaultScope, scopeId: string): Promise<VaultFolder[]> {
  return pb.collection(FOLDERS).getFullList<VaultFolder>({
    filter: scopeFilter(scope, scopeId),
    sort: 'name',
  });
}

/**
 * Folders whose NAME matches, across every readable library. Search asked only
 * about filenames before, which meant a folder called "Pleadings" could not be
 * found by typing "pleadings" — the one thing the word obviously refers to.
 */
export async function searchFolders(query: string, limit = 50): Promise<VaultFolder[]> {
  // Same treatment as the document filter: the value is interpolated into a
  // PocketBase expression, and a stray quote would break it.
  const q = query.trim().replace(/["\\]/g, '');
  if (!q) return [];
  const res = await pb.collection(FOLDERS).getList<VaultFolder>(1, limit, {
    filter: `trashed != true && name ~ "${q}"`,
    sort: 'name',
    skipTotal: true,
  });
  return res.items;
}

export function listDocuments(scope: VaultScope, scopeId: string): Promise<VaultDocument[]> {
  return pb.collection(DOCS).getFullList<VaultDocument>({
    filter: scopeFilter(scope, scopeId),
    sort: '-created',
  });
}

// ── Cross-library reads (mobile home) ───────────────────────────────────────
// The mobile vault home is category-first rather than library-first, so it needs
// "every document this user can see" rather than one scope's listing. No client
// scoping is applied: AiVaultDocuments' list rule already restricts rows to the
// caller's org libraries and the custom vaults they're a member of, so an
// unfiltered listing returns exactly the readable set.

/** Mime predicates for the home's category tiles. `documents` is "everything else". */
export const VAULT_MIME_FILTERS = {
  images: 'mime ~ "image/%"',
  audio: 'mime ~ "audio/%"',
  documents: 'mime !~ "image/%" && mime !~ "audio/%" && mime !~ "video/%"',
} as const;

export type VaultMimeCategory = keyof typeof VAULT_MIME_FILTERS;

function withLive(extra?: string): string {
  // `trashed != true` rather than `trashed = false`: rows written before the
  // soft-delete field existed carry null, and `!=` matches those.
  return extra ? `trashed != true && (${extra})` : 'trashed != true';
}

/** Newest documents across every readable library. */
export async function listRecentDocuments(limit = 30, extra?: string): Promise<VaultDocument[]> {
  const res = await pb.collection(DOCS).getList<VaultDocument>(1, limit, {
    filter: withLive(extra),
    sort: '-created',
    skipTotal: true,
  });
  return res.items;
}

/** Row count across every readable library (used for the home's subtitles). */
export async function countDocuments(extra?: string): Promise<number> {
  const res = await pb.collection(DOCS).getList<VaultDocument>(1, 1, { filter: withLive(extra) });
  return res.totalItems;
}

/** Soft-deleted rows across every readable library — the mobile Recycle bin. */
export async function listTrashedDocuments(limit = 200): Promise<VaultDocument[]> {
  const res = await pb.collection(DOCS).getList<VaultDocument>(1, limit, {
    filter: 'trashed = true',
    sort: '-trashed_at',
    skipTotal: true,
  });
  return res.items;
}

/**
 * Trashed FOLDERS across every readable library, unfiltered.
 *
 * The topmost-only filtering deliberately does NOT happen here: it has to be
 * done against the documents as well (see `binRows` in useVaultBrowse), and a
 * function that can only see folders would get it half right.
 */
export async function listTrashedFolders(limit = 200): Promise<VaultFolder[]> {
  const res = await pb.collection(FOLDERS).getList<VaultFolder>(1, limit, {
    filter: 'trashed = true',
    sort: '-trashed_at',
    skipTotal: true,
  });
  return res.items;
}

/** Trashed rows across every readable library — the home's Recycle bin count. */
export async function countTrashedDocuments(): Promise<number> {
  const res = await pb.collection(DOCS).getList<VaultDocument>(1, 1, { filter: 'trashed = true' });
  return res.totalItems;
}

// Fetch a single document by id (used to open a citation's source document).
// Resolves to null if the document is missing or the caller can't view it — the
// AiVaultDocuments collection's view rule still governs access here.
export function getDocument(id: string): Promise<VaultDocument | null> {
  return pb.collection(DOCS).getOne<VaultDocument>(id).catch(() => null);
}

// ── Per-document facts (verification trail) ──────────────────────────────────
// A single fact the AI distilled from a document: an atomic statement, its page
// locator (in provenance), and the confidence the text stated it. Mirrors the
// ai/memory Memory read view returned by /ai/vault/documents/{id}/facts.
export interface VaultFact {
  id: string;
  content: string;
  tags?: string[];
  confidence: number;
  /** provenance.type is always "document"; locator is the page/clause citation. */
  provenance?: { type?: string; ref?: string; locator?: string };
  created?: string;
}

export interface VaultFactsResult {
  document: string;
  status: VaultStatus;
  count: number;
  facts: VaultFact[];
}

/**
 * Fetch the facts the AI distilled from one document — the per-document
 * verification trail shown in the preview's "Facts" tab. Gated like the other
 * document endpoints (org membership + Vaults entitlement + scope access).
 */
export function getDocumentFacts(id: string): Promise<VaultFactsResult> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}/facts`, { method: 'GET' });
}

// ── Realtime ────────────────────────────────────────────────────────────────
// Subscribe to both collections for a library; the callback fires on any
// create/update/delete so the browser can patch its in-memory tree (and watch a
// document advance pending → processing → ingested live). Returns an async
// unsubscribe fn. Note: PB realtime ignores the server-side list rule's row
// filter for *which* events arrive, so we re-check scope in the callback.

export type VaultRealtimeEvent =
  | { kind: 'document'; action: string; record: VaultDocument }
  | { kind: 'folder'; action: string; record: VaultFolder };

export async function subscribeVault(
  scope: VaultScope,
  scopeId: string,
  cb: (e: VaultRealtimeEvent) => void,
): Promise<() => void> {
  const inScope = (r: { scope?: string; scope_id?: string }) =>
    r?.scope === scope && r?.scope_id === scopeId;

  const unsubDocs = await pb.collection(DOCS).subscribe<VaultDocument>('*', (e) => {
    if (inScope(e.record)) cb({ kind: 'document', action: e.action, record: e.record });
  });
  const unsubFolders = await pb.collection(FOLDERS).subscribe<VaultFolder>('*', (e) => {
    if (inScope(e.record)) cb({ kind: 'folder', action: e.action, record: e.record });
  });
  return () => {
    unsubDocs();
    unsubFolders();
  };
}

/**
 * Build a URL for a document's original file.
 *
 * `intent` is not cosmetic. The server gates and logs this route
 * (ai/vault_access.go), and it reads the two senses of "access" apart from the
 * `download` query parameter PocketBase already uses for Content-Disposition:
 * 'download' asks for bytes to keep and needs the download capability, 'preview'
 * asks for a read in the app and needs only view. Passing the wrong one either
 * denies a legitimate read or records a copy that was never taken — so a caller
 * that is opening the reader must say so.
 *
 * Returns "" if the doc has no stored file.
 */
export async function vaultFileUrl(
  doc: VaultDocument,
  intent: 'preview' | 'download' = 'preview',
): Promise<string> {
  if (!doc.file) return '';
  const token = await pb.files.getToken();
  const query: Record<string, string> = { token };
  if (intent === 'download') query.download = '1';
  return pb.files.getURL(doc as any, doc.file, query);
}

/**
 * A folder, or a multi-selection, as one zip.
 *
 * On progress: the archive is streamed, so there is no Content-Length. The server
 * instead sends the UNCOMPRESSED total it is about to write (from the per-document
 * sizes recorded at upload) and the file count, and stores rather than deflates
 * everything already compressed — so bytes received over that total is a real
 * fraction, not an estimate. It reads 0 only when every document in the selection
 * predates the size column, and the UI falls back to an indeterminate ring there.
 *
 * The body is read here rather than handed to the browser as a plain download,
 * which is what makes progress possible at all — and what makes it hold the
 * archive in memory. That is the trade, and it is why the server caps the file
 * count: a bounded archive is one a phone can hold.
 */
export async function downloadArchive(
  scope: VaultScope,
  scopeId: string,
  sel: { folders?: string[]; documents?: string[] },
  onProgress?: (p: { bytes: number; files: number; total: number }) => void,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/vault/download`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, scope_id: scopeId, folders: sel.folders || [], documents: sel.documents || [] }),
  });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { msg = (await res.json())?.message || msg; } catch { /* not json */ }
    throw new Error(msg);
  }

  const files = Number(res.headers.get('X-Vault-Zip-Files') || 0);
  const total = Number(res.headers.get('X-Vault-Zip-Bytes') || 0);
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition')) || 'documents.zip';

  // No reader (an old WebView, or a response the runtime buffered anyway): take
  // the blob whole. The download still works, it just arrives without progress.
  if (!res.body?.getReader) {
    return { blob: await res.blob(), filename };
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.byteLength;
    onProgress?.({ bytes, files, total });
  }
  return { blob: new Blob(chunks, { type: 'application/zip' }), filename };
}

function filenameFromDisposition(header: string | null): string {
  const m = header?.match(/filename="([^"]+)"/);
  return m ? m[1] : '';
}

/** Hand a finished blob to the browser as a save. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick, not immediately: Safari and the Android WebView
  // start the save asynchronously and a revoked URL cancels it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Writes (gated endpoints) ────────────────────────────────────────────────

async function vaultFetch(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { Authorization: pb.authStore.token, ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch { /* noop */ }
    // A 403 is either "feature not enabled for this org" (entitlement) or a
    // per-vault permission denial. Only the former should disable the surface.
    if (res.status === 403 && /not enabled/i.test(msg)) {
      throw new VaultDisabledError();
    }
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

/** Thrown when the org lacks the Vaults entitlement (HTTP 403 from a write). */
export class VaultDisabledError extends Error {
  constructor() {
    super('The vault feature is not enabled for this organisation.');
    this.name = 'VaultDisabledError';
  }
}

export function createFolder(input: {
  scope: VaultScope;
  scopeId: string;
  parent?: string;
  name: string;
}): Promise<VaultFolder> {
  return vaultFetch('/api/practocore/ai/vault/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: input.scope,
      scope_id: input.scopeId,
      parent: input.parent ?? '',
      name: input.name,
    }),
  });
}

export function renameFolder(id: string, name: string): Promise<VaultFolder> {
  return vaultFetch(`/api/practocore/ai/vault/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function moveFolder(id: string, parent: string): Promise<VaultFolder> {
  return vaultFetch(`/api/practocore/ai/vault/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent }),
  });
}

/**
 * Where a copy or a relocation lands. Omitting `scope`/`scopeId` means "the
 * library it is already in", which is what an ordinary in-folder copy wants;
 * naming a different library is how a document crosses from a matter into an
 * engagement, or out of a custom vault into the firm library.
 */
export interface VaultDest {
  scope?: VaultScope;
  scopeId?: string;
  /** Folder id inside the destination library; "" is its root. */
  folder?: string;
}

function destBody(dest: VaultDest, key: 'folder' | 'parent') {
  return JSON.stringify({
    scope: dest.scope ?? '',
    scope_id: dest.scopeId ?? '',
    [key]: dest.folder ?? '',
  });
}

/**
 * Duplicate a folder, its subfolders and every document under them into `dest`.
 * The root of the copy is renamed ("… (copy)") when a sibling there already
 * holds its name, so copying a folder next to itself works.
 *
 * The copies land stored-only: distilled facts belong to a library rather than a
 * folder, so a copy that re-ingested would buy a second identical set of them.
 * Use {@link setDocumentIngest} on a copy that should be read on its own.
 */
export function copyFolder(id: string, dest: VaultDest): Promise<VaultFolder> {
  return vaultFetch(`/api/practocore/ai/vault/folders/${id}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: destBody(dest, 'parent'),
  });
}

/**
 * Relocate a folder, possibly into ANOTHER library — which {@link moveFolder}
 * cannot do, because rewriting a parent id only means anything inside one
 * library. Within a library this is the same operation; across one it copies the
 * subtree and removes the original, carrying each document's AI setting with it.
 */
export function relocateFolder(id: string, dest: VaultDest): Promise<VaultFolder> {
  return vaultFetch(`/api/practocore/ai/vault/folders/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: destBody(dest, 'parent'),
  });
}

/**
 * Move a folder (and its whole subtree) to the Trash, or restore it. Soft-delete:
 * the rows are hidden from the normal listing but kept for restore; distilled
 * facts are retired only on a permanent {@link deleteFolder}.
 */
export function setFolderTrashed(id: string, trashed: boolean): Promise<VaultFolder> {
  return vaultFetch(`/api/practocore/ai/vault/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed }),
  });
}

/** Permanently delete a folder and its subtree (retires the distilled facts). */
export function deleteFolder(id: string): Promise<{ deleted: boolean }> {
  return vaultFetch(`/api/practocore/ai/vault/folders/${id}`, { method: 'DELETE' });
}

/** Move a document to another folder in the same library ("" = library root). */
export function moveDocument(id: string, folder: string): Promise<VaultDocument> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
}

/**
 * Duplicate a document into `dest`, file and all. The copy is a new document,
 * not a second reference: deleting either side leaves the other whole. It lands
 * stored-only — see {@link copyFolder}.
 */
export function copyDocument(id: string, dest: VaultDest): Promise<VaultDocument> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: destBody(dest, 'folder'),
  });
}

/**
 * Relocate a document, possibly into ANOTHER library — see
 * {@link relocateFolder}. Crossing libraries retires the document's distilled
 * facts from the one it leaves and re-distils them into the one it arrives in,
 * because facts are scoped to a library; the document keeps its AI setting.
 */
export function relocateDocument(id: string, dest: VaultDest): Promise<VaultDocument> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: destBody(dest, 'folder'),
  });
}

/** Move a document to the Trash, or restore it (soft-delete; see setFolderTrashed). */
export function setDocumentTrashed(id: string, trashed: boolean): Promise<VaultDocument> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed }),
  });
}

/**
 * Toggle AI ingestion for an existing document. Turning it on re-queues the
 * document for distillation; turning it off retires the facts it produced and
 * drops it back to "stored only".
 */
export function setDocumentIngest(id: string, ingest: boolean): Promise<VaultDocument> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingest }),
  });
}

/** Permanently delete a document (retires the facts the AI distilled from it). */
export function deleteDocument(id: string): Promise<{ deleted: boolean; memories_retired: number }> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}`, { method: 'DELETE' });
}

// ── access policy + history (VAULT_PERMISSIONS_PLAN.md) ─────────────────────

/** The three things a library or a document can be restricted on. */
export type VaultAccessAxis = 'view' | 'download' | 'ai';
export type VaultAccessSetting = 'allow' | 'deny';

/**
 * A library's access policy. Every axis reads back resolved, so the caller never
 * has to know that an unset setting and "allow" are the same thing.
 */
export interface VaultPolicy {
  downloads: VaultAccessSetting;
  view: VaultAccessSetting;
  ai: VaultAccessSetting;
  default_role: VaultRole | '';
  /** Whether THIS caller may change the above. */
  can_manage: boolean;
}

/** Read a library's access policy. */
export function getVaultPolicy(scope: VaultScope, scopeId: string): Promise<VaultPolicy> {
  const q = new URLSearchParams({ scope, scope_id: scopeId });
  return vaultFetch(`/api/practocore/ai/vault/policy?${q}`, { method: 'GET' });
}

/**
 * Write a library's access policy. Omitting an axis leaves it unset, which
 * resolves as allow — so this is a whole-policy write, not a patch.
 */
export function setVaultPolicy(
  scope: VaultScope,
  scopeId: string,
  policy: Partial<Pick<VaultPolicy, 'downloads' | 'view' | 'ai' | 'default_role'>>,
): Promise<Omit<VaultPolicy, 'can_manage'>> {
  return vaultFetch('/api/practocore/ai/vault/policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, scope_id: scopeId, ...policy }),
  });
}

/**
 * Restrict a single document, or clear its overrides by passing {}. Needs the
 * same right as setting the library policy — restricting one file is an access
 * decision, not a filing one.
 */
export function setDocumentRestrictions(
  id: string,
  restrictions: Partial<Record<VaultAccessAxis, VaultAccessSetting>>,
): Promise<VaultDocument> {
  return vaultFetch(`/api/practocore/ai/vault/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restrictions }),
  });
}

/** One row of the access log. */
export interface VaultAccessEvent {
  id: string;
  actor: string;
  document: string;
  action: 'view' | 'download' | 'zip' | 'ai_read' | 'denied';
  reason: string;
  ip: string;
  user_agent: string;
  created: string;
}

/**
 * Who has read or taken what, newest first. Pass a document id to narrow it to
 * one file; the library is then inferred from the document. Readable only by
 * whoever may administer the library — the log is itself confidential.
 */
export function getVaultAccessHistory(
  args: { scope?: VaultScope; scopeId?: string; documentId?: string },
): Promise<{ events: VaultAccessEvent[] }> {
  const q = new URLSearchParams();
  if (args.scope) q.set('scope', args.scope);
  if (args.scopeId) q.set('scope_id', args.scopeId);
  if (args.documentId) q.set('document', args.documentId);
  return vaultFetch(`/api/practocore/ai/vault/access-history?${q}`, { method: 'GET' });
}

export interface UploadResult {
  id: string;
  status: VaultStatus;
  filename: string;
  scope: VaultScope;
  scope_id: string;
  message: string;
}

/**
 * Upload one document. Uses XMLHttpRequest (not fetch) so the caller gets upload
 * progress (0..1). Server extracts text synchronously, so a scanned PDF / bad
 * type rejects here with an actionable message; otherwise the doc is queued and
 * its ingestion progress arrives over the realtime subscription.
 */
export function uploadDocument(
  input: {
    file: File; scope: VaultScope; scopeId: string; folder?: string;
    /** Classification slug (case_document / court_transcript / other). */
    docType?: string;
    /** Whether the AI should read + commit this document to the knowledge base. */
    ingest?: boolean;
  },
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', input.file);
    form.append('scope', input.scope);
    form.append('scope_id', input.scopeId);
    if (input.folder) form.append('folder', input.folder);
    if (input.docType) form.append('doc_type', input.docType);
    if (input.ingest !== undefined) form.append('ingest', String(input.ingest));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SERVER_URL}/api/practocore/ai/vault/upload`);
    xhr.setRequestHeader('Authorization', pb.authStore.token);
    xhr.upload.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable) onProgress(ev.loaded / ev.total);
    };
    xhr.onload = () => {
      let body: any = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* noop */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        track('vault_document_uploaded', {
          scope: input.scope,
          doc_type: input.docType || 'unspecified',
          ingest: input.ingest ?? false,
          // File extension only — never the filename (can carry a client/matter name).
          ext: input.file.name.split('.').pop()?.toLowerCase() || 'unknown',
        });
        resolve(body as UploadResult);
      } else if (xhr.status === 403) {
        reject(new VaultDisabledError());
      } else {
        reject(new Error(body?.message || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

// ── Entitlements ────────────────────────────────────────────────────────────

// ── Custom vault CRUD ────────────────────────────────────────────────────────

/** List the custom vaults the current user is an active member of (read rule). */
export function listVaults(): Promise<Vault[]> {
  return pb.collection(VAULTS).getFullList<Vault>({
    filter: pb.filter('trashed != true'),
    sort: 'name',
  });
}

/** Subscribe to the user's vault list for live add/rename/remove. */
export async function subscribeVaults(cb: (action: string, record: Vault) => void): Promise<() => void> {
  return pb.collection(VAULTS).subscribe<Vault>('*', (e) => cb(e.action, e.record));
}

export function createVault(input: {
  name: string;
  description?: string;
  visibility?: 'personal' | 'shared';
  ai_read_default?: boolean;
}): Promise<Vault> {
  return vaultFetch('/api/practocore/ai/vaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((v) => {
    track('vault_created', { visibility: input.visibility || 'personal', ai_read_default: input.ai_read_default ?? false });
    return v;
  });
}

export function updateVault(id: string, patch: {
  name?: string;
  description?: string;
  visibility?: 'personal' | 'shared';
  ai_read_default?: boolean;
  trashed?: boolean;
}): Promise<Vault> {
  return vaultFetch(`/api/practocore/ai/vaults/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function deleteVault(id: string): Promise<{ deleted: boolean }> {
  return vaultFetch(`/api/practocore/ai/vaults/${id}`, { method: 'DELETE' });
}

// ── Membership ───────────────────────────────────────────────────────────────

/** List members of a vault (read rule: co-members only). */
export function listMembers(vaultId: string): Promise<VaultMember[]> {
  return pb.collection(MEMBERS).getFullList<VaultMember>({
    filter: pb.filter('vault = {:v}', { v: vaultId }),
    sort: 'created',
  });
}

export function inviteMember(vaultId: string, input: {
  user?: string;
  email?: string;
  role: VaultRole;
  caps?: Record<string, boolean>;
}): Promise<VaultMember> {
  return vaultFetch(`/api/practocore/ai/vaults/${vaultId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateMember(vaultId: string, memberId: string, patch: {
  role?: VaultRole;
  caps?: Record<string, boolean>;
}): Promise<VaultMember> {
  return vaultFetch(`/api/practocore/ai/vaults/${vaultId}/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function removeMember(vaultId: string, memberId: string): Promise<{ deleted: boolean }> {
  return vaultFetch(`/api/practocore/ai/vaults/${vaultId}/members/${memberId}`, { method: 'DELETE' });
}

export async function getEntitlements(): Promise<Entitlements> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/entitlements`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) {
    return { memory: false, skills: false, vaults: false, documents: false, modelCeiling: '' };
  }
  return res.json();
}

/**
 * Provider settings use their own fetch rather than vaultFetch: vaultFetch maps any
 * 403 whose message matches /not enabled/i to VaultDisabledError, which would both
 * swallow the real message and wrongly mark the VAULT surface disabled when a firm
 * has simply not permitted an AI provider. Same auth + error-message extraction,
 * without the vault-specific special case.
 */
async function providerFetch(path: string, body: unknown): Promise<AIProviderState> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'PATCH',
    headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

/**
 * One recorded action: something the assistant changed, and whether it can be taken
 * back. `approval` says who allowed it — a person on a permission card, or auto
 * mode's policy — which is the distinction the ledger exists to preserve.
 */
export type AiAction = {
  id: string;
  tool: string;
  risk: string;
  approval: 'manual' | 'auto';
  status: 'applied' | 'failed' | 'undone';
  op: 'create' | 'update' | 'delete' | 'none';
  entity?: string;
  entityId?: string;
  undoable: boolean;
  reason?: string;
  error?: string;
  conversation?: string;
  created: string;
  undoneAt?: string;
};

/** The signed-in member's recorded actions, newest first. */
export async function getAiActions(conversationId?: string): Promise<AiAction[]> {
  const qs = conversationId ? `?conversation=${encodeURIComponent(conversationId)}` : '';
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/actions${qs}`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const body = await res.json();
  return body?.actions || [];
}

/** Reverse one recorded action. Returns the updated row. */
export async function undoAiAction(id: string): Promise<AiAction> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/actions/${id}/undo`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return (await res.json())?.action;
}

/**
 * Auto mode: whether an approval-gated action may run without a permission card.
 *
 * Two layers, and each may only narrow the other — the firm can switch it off for
 * everyone, and a member who has not opted in does not get it even where the firm
 * allows it. `enabled` is the resolved answer; the other two say why.
 */
export type AutoModeState = {
  enabled: boolean;
  memberOptedIn: boolean;
  firmDisabled: boolean;
  /** How many changes one turn may make on its own before it stops and asks. */
  maxWrites: number;
  /** The tools auto mode may run unattended, named rather than implied. */
  autoApprovable: string[];
};

/** Read the resolved auto-mode position for the signed-in member. */
export async function getAutoMode(): Promise<AutoModeState> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/automode`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** Opt the signed-in member in or out. */
export function setMyAutoMode(enabled: boolean): Promise<AutoModeState> {
  return autoModeFetch('/api/practocore/ai/automode/me', { enabled });
}

/** The firm-level veto. Admin-only server-side. */
export function setFirmAutoModeDisabled(disabled: boolean): Promise<AutoModeState> {
  return autoModeFetch('/api/practocore/ai/automode/org', { disabled });
}

async function autoModeFetch(path: string, body: unknown): Promise<AutoModeState> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'PATCH',
    headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Set which providers the FIRM permits. Admin-only server-side; writes
 * feature_overrides.ai_providers on the Organisations record.
 */
export function setOrgAllowedProviders(providers: AIProvider[]): Promise<AIProviderState> {
  return providerFetch('/api/practocore/ai/providers/org', { providers });
}

/** Set the signed-in member's own preference. '' follows the firm default. */
export function setMyProvider(provider: AIProvider | ''): Promise<AIProviderState> {
  return providerFetch('/api/practocore/ai/providers/me', { provider });
}

/**
 * Set the FIRM's per-task model assignments (advanced mode). Admin-only
 * server-side; writes feature_overrides.ai_task_models on the Organisations record.
 *
 * The map REPLACES what is stored rather than merging into it, so clearing a slot
 * is expressed by omitting it and sending {} returns the firm to the defaults.
 */
export function setOrgTaskModels(tasks: Record<string, string>): Promise<AIProviderState> {
  return providerFetch('/api/practocore/ai/tasks/org', { tasks });
}

/** Set the signed-in member's own per-task assignments, within what the firm allows. */
export function setMyTaskModels(tasks: Record<string, string>): Promise<AIProviderState> {
  return providerFetch('/api/practocore/ai/tasks/me', { tasks });
}
