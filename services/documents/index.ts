import { pb } from '~/lib/pocketbase';

// ── Generated documents service ───────────────────────────────────────────────
// Surfaces the AI document-generation feature (practocore-backend/ai/docgen) to
// the frontend. The generate_document tool renders an editable .docx and stores it
// in the GeneratedDocuments collection, which exposes an org-scoped list/view rule
// — so reads + realtime go straight through the PocketBase SDK (the writes happen
// only through the gated, approval-flow AI tool, never from here).
//
// The stored file is protected by the collection's view rule, so a download URL
// needs a short-lived file token appended (mirrors services/vault vaultFileUrl).

export interface GeneratedDocument {
  id: string;
  collectionId?: string;
  collectionName?: string;
  /** "" for a personal (non-org) document. */
  org: string;
  /** Matters id this document relates to, or "" if standalone. */
  matter: string;
  /** Engagements id this document relates to, or "" if standalone/matter-filed. */
  engagement: string;
  /** Users id who generated it. */
  author: string;
  /** plaint | contract | letter | affidavit | ... */
  kind: string;
  title: string;
  /** Stored filename of the .docx in PocketBase storage. */
  file: string;
  filename: string;
  created: string;
  updated: string;
}

const COLLECTION = 'GeneratedDocuments';

// ── Reads (PocketBase SDK) ────────────────────────────────────────────────────

/** All generated documents filed under a matter, newest first. */
export function listMatterDocuments(matterId: string): Promise<GeneratedDocument[]> {
  return pb.collection(COLLECTION).getFullList<GeneratedDocument>({
    filter: pb.filter('matter = {:matterId}', { matterId }),
    sort: '-created',
  });
}

/** All generated documents filed under an Engagement, newest first. */
export function listEngagementDocuments(engagementId: string): Promise<GeneratedDocument[]> {
  return pb.collection(COLLECTION).getFullList<GeneratedDocument>({
    filter: pb.filter('engagement = {:engagementId}', { engagementId }),
    sort: '-created',
  });
}

// ── Realtime ──────────────────────────────────────────────────────────────────
// Watch a matter's documents so a freshly drafted one appears without a reload.
// PB realtime ignores the list rule's row filter for *which* events arrive, so we
// re-check the matter in the callback. Returns an async unsubscribe fn.

export async function subscribeMatterDocuments(
  matterId: string,
  cb: (action: string, record: GeneratedDocument) => void,
): Promise<() => void> {
  return pb.collection(COLLECTION).subscribe<GeneratedDocument>('*', (e) => {
    if (e.record?.matter === matterId) cb(e.action, e.record);
  });
}

/** Same as subscribeMatterDocuments, scoped to an Engagement instead. */
export async function subscribeEngagementDocuments(
  engagementId: string,
  cb: (action: string, record: GeneratedDocument) => void,
): Promise<() => void> {
  return pb.collection(COLLECTION).subscribe<GeneratedDocument>('*', (e) => {
    if (e.record?.engagement === engagementId) cb(e.action, e.record);
  });
}

/**
 * Build a downloadable URL for a generated document's .docx. The collection's
 * view rule requires auth, so the file is protected and needs a short-lived file
 * token appended — hence async. Returns "" if the row has no stored file.
 */
export async function documentFileUrl(doc: GeneratedDocument): Promise<string> {
  if (!doc.file) return '';
  const token = await pb.files.getToken();
  return pb.files.getURL(doc as any, doc.file, { token });
}

/** Trigger a browser download of the document's .docx. */
export async function downloadDocument(doc: GeneratedDocument): Promise<void> {
  const url = await documentFileUrl(doc);
  if (!url) return;
  const a = window.document.createElement('a');
  a.href = url;
  a.download = doc.filename || `${doc.title || 'document'}.docx`;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
}

// Human label for a document kind chip.
export function documentKindLabel(kind: string): string {
  if (!kind) return 'Document';
  return kind.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
