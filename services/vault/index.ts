import { pb, SERVER_URL } from '~/lib/pocketbase';

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
export type VaultScope = 'matter' | 'org' | 'vault';

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
  status: VaultStatus;
  facts_count: number;
  provider: string;
  error: string;
  /** Soft-delete flag — true means the document is in the Trash. */
  trashed?: boolean;
  trashed_at?: string;
  created_by: string;
  created: string;
  updated: string;
}

// A normalized list entry (folder or document) for the unified explorer view, so
// folders and documents can share one row/card component and one sort.
export interface VaultEntry {
  kind: 'folder' | 'doc';
  id: string;
  name: string;
  /** ISO timestamp used for the "Modified" column / sorting. */
  modified: string;
  /** Direct child count (folders only). */
  count?: number;
  /** Folder path label, set in the flat search / trash views. */
  path?: string;
  /** Ingestion fields (documents only). */
  status?: VaultStatus;
  factsCount?: number;
  mime?: string;
  filename?: string;
  failedError?: string;
  /** Classification + AI-ingestion flag (documents only). */
  docType?: string;
  ingest?: boolean;
  /** Soft-delete flag mirrored onto the entry for the Trash view. */
  trashed?: boolean;
  trashedAt?: string;
  /** The underlying record. */
  raw: VaultFolder | VaultDocument;
}

export interface Entitlements {
  memory: boolean;
  skills: boolean;
  vaults: boolean;
  documents: boolean;
  modelCeiling: string;
}

// ── Custom vaults (membership-scoped) ────────────────────────────────────────
// Mirrors ai/vault/vaults.go. A custom vault is a named container with members;
// its documents live in the same AiVaultDocuments/AiVaultFolders collections with
// scope='vault', scope_id=<vault id>.

export const VAULT_ROLES = ['owner', 'manager', 'contributor', 'viewer'] as const;
export type VaultRole = (typeof VAULT_ROLES)[number];

export const VAULT_CAPS = [
  'query', 'add_files', 'remove_files', 'manage_folders',
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
    query: true, add_files: true, remove_files: true, manage_folders: true,
    toggle_ai: true, invite: true, manage_permissions: true,
  },
  contributor: { query: true, add_files: true, remove_files: true, manage_folders: true },
  viewer: { query: true },
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

export function listDocuments(scope: VaultScope, scopeId: string): Promise<VaultDocument[]> {
  return pb.collection(DOCS).getFullList<VaultDocument>({
    filter: scopeFilter(scope, scopeId),
    sort: '-created',
  });
}

// Fetch a single document by id (used to open a citation's source document).
// Resolves to null if the document is missing or the caller can't view it — the
// AiVaultDocuments collection's view rule still governs access here.
export function getDocument(id: string): Promise<VaultDocument | null> {
  return pb.collection(DOCS).getOne<VaultDocument>(id).catch(() => null);
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
 * Build a downloadable URL for a document's original file. The collection's
 * view rule requires auth, so the file is protected and needs a short-lived file
 * token appended — hence async. Returns "" if the doc has no stored file.
 */
export async function vaultFileUrl(doc: VaultDocument): Promise<string> {
  if (!doc.file) return '';
  const token = await pb.files.getToken();
  return pb.files.getURL(doc as any, doc.file, { token });
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
