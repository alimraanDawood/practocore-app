import { pb, SERVER_URL } from '~/lib/pocketbase';
import { track } from '~/utils/analytics';

// ── Message content blocks ─────────────────────────────────────────────────────
// User messages can now carry image and PDF attachments alongside text. The shape
// mirrors Anthropic's Messages API content blocks (and our Go `ContentBlock`
// struct in practocore-backend/ai/anthropic.go) so the values pass through the
// backend unchanged. The text-only `string` form is preserved for backward
// compatibility with the existing chat history persistence.

export type AiImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export interface AiTextBlock {
  type: 'text';
  text: string;
}

export interface AiImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: AiImageMediaType;
    /** base64-encoded bytes, no `data:` URI prefix */
    data: string;
  };
}

export interface AiDocumentBlock {
  type: 'document';
  source:
    | {
        type: 'base64';
        media_type: 'application/pdf';
        /** base64-encoded PDF bytes, no `data:` URI prefix */
        data: string;
      }
    | {
        // Plain-text documents (Markdown, .txt, source files). Anthropic reads a
        // text document block natively; `data` is the RAW UTF-8 text, not base64.
        // The backend forwards source.{type,media_type,data} verbatim.
        type: 'text';
        media_type: 'text/plain';
        data: string;
      };
}

export type AiContentBlock = AiTextBlock | AiImageBlock | AiDocumentBlock;

// Metadata side-channel for attached files. The content blocks above carry no
// filename, so we pair each attachment to its block by a content hash (sha256 of the
// block's transmitted `data` string — see attachmentSha256). The backend persists
// these to AiChatAttachments. See practocore-backend/ai/attachments.go (AttachmentMeta).
export interface AiAttachmentMeta {
  /** sha256 hex of the block's `data` string; the join + idempotency key. */
  sha256: string;
  name: string;
  mime: string;
  kind: 'binary' | 'text';
  size: number;
}

/**
 * Hash an attachment's transmitted `data` string, byte-identically to the backend.
 * Best-effort: SubtleCrypto needs a secure context, so on failure we return '' — the
 * file is still persisted server-side (the backend computes its own hash for storage
 * and dedup); it just falls back to a generated filename instead of the original.
 */
export async function attachmentSha256(data: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/**
 * Turn raw base64 into an object URL for a freshly-attached file, so the in-app
 * preview can fetch it (the previewer reads via XHR, which is unreliable on `data:`
 * URLs — a blob URL behaves like the token URL used on reload). Caller owns revocation.
 */
export function base64ToObjectUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string | AiContentBlock[];
}

// Display/lookup record for one file attached to a user turn. Carries no bytes; the
// downloadable URL is resolved by matching `sha256` against the AiChatAttachments
// rows for the conversation. Mirrors the Go ConvAttachment struct.
export interface ConvAttachment {
  name?: string;
  mime?: string;
  kind?: 'binary' | 'text';
  size?: number;
  sha256: string;
}

// Broader message type used for conversation persistence (includes tool-event roles).
// Assistant turns may carry the activity steps that produced them so the "Worked for
// Ns" summary can be rehydrated when a saved conversation is reloaded.
export interface ConvDisplayMessage {
  role: string;
  content: string;
  steps?: AiStreamStep[];
  durationMs?: number;
  citations?: AiCitation[];
  /** Attachment refs for a user turn, so chips survive a reload. */
  attachments?: ConvAttachment[];
}

// ── Persisted chat attachments (AiChatAttachments) ─────────────────────────────
// Phase 1 persists every attached file's bytes here, keyed to the conversation. The
// chat UI resolves a turn's ConvAttachment refs to downloadable URLs by matching on
// the content hash. Reads go through the SDK (the collection's owner/org read rule);
// writes happen only on the chat/confirm legs, never from here.

export interface ChatAttachmentRow {
  id: string;
  collectionId?: string;
  collectionName?: string;
  conversation: string;
  owner: string;
  org: string;
  file: string;
  name: string;
  mime: string;
  kind: 'binary' | 'text';
  sha256: string;
  size: number;
  /** Set once the file has been promoted into the per-conversation vault (Phase 3). */
  vault?: string;
  vault_doc?: string;
  created: string;
}

/** All persisted attachment rows for a conversation, oldest first. */
export function listConversationAttachments(conversationId: string): Promise<ChatAttachmentRow[]> {
  return pb.collection('AiChatAttachments').getFullList<ChatAttachmentRow>({
    filter: pb.filter('conversation = {:c}', { c: conversationId }),
    sort: 'created',
  });
}

/**
 * Resolve sha256 → downloadable URL for a conversation's attachments. The collection
 * is read-protected, so each URL needs a short-lived file token; one token serves the
 * whole batch. Returns an empty map if the conversation has no stored attachments.
 */
export async function resolveAttachmentUrls(conversationId: string): Promise<Map<string, string>> {
  const rows = await listConversationAttachments(conversationId);
  const map = new Map<string, string>();
  if (!rows.length) return map;
  const token = await pb.files.getToken();
  for (const row of rows) {
    if (row.file) map.set(row.sha256, pb.files.getURL(row as any, row.file, { token }));
  }
  return map;
}

export interface PromoteAttachmentsResult {
  vault: string;
  vault_name?: string;
  promoted: number;
  ingesting?: number;
  message?: string;
  error?: string;
}

/**
 * Promote a conversation's attachments into its per-conversation vault (Phase 3,
 * suggest-mode). Creates the vault on first use; idempotent server-side (only files
 * not yet promoted are moved). Reuses the persisted bytes — nothing is re-uploaded.
 */
export async function promoteConversationAttachments(conversationId: string): Promise<PromoteAttachmentsResult> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/attachments/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': pb.authStore.token,
      },
      body: JSON.stringify({ conversation: conversationId }),
    });
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try { const j = await res.json() as { message?: string }; if (j?.message) msg = j.message; } catch { /* noop */ }
      return { vault: '', promoted: 0, error: msg };
    }
    return await res.json() as PromoteAttachmentsResult;
  } catch (e: any) {
    return { vault: '', promoted: 0, error: e?.message ?? 'Network error' };
  }
}

export interface VaultIngestProgress {
  /** AI-readable documents in the vault whose distillation has finished (or failed). */
  done: number;
  /** Total AI-readable documents in the vault. 0 when nothing is being ingested. */
  total: number;
}

/**
 * Ingestion progress for a vault: how many of its AI-readable documents have finished
 * distilling. Polled by the chat after a promotion to show a quiet "Processing n/m"
 * ring. Reads AiVaultDocuments directly (the owner is an active member, so the
 * membership-gated read rule allows it). Best-effort: returns {0,0} on failure.
 */
export async function vaultIngestProgress(vaultId: string): Promise<VaultIngestProgress> {
  try {
    const rows = await pb.collection('AiVaultDocuments').getFullList<{ status: string }>({
      filter: pb.filter('scope = "vault" && scope_id = {:v} && ingest = true', { v: vaultId }),
      fields: 'status',
    });
    const done = rows.filter(r => r.status === 'ingested' || r.status === 'failed').length;
    return { done, total: rows.length };
  } catch {
    return { done: 0, total: 0 };
  }
}

// A verifiable source the assistant consulted while producing an answer. The
// backend builds these in practocore-backend/ai/citations.go (keep in sync). The
// answer text may reference one inline as a [[cite:<citeId>]] marker, and every
// citation also appears in the "Sources" footer. `kind` drives how the popover
// renders and what "open" does.
export interface AiCitation {
  citeId: string;
  kind: 'memory' | 'legal' | 'matter' | 'web' | 'authority' | 'legislation' | 'help';
  title: string;
  snippet?: string;
  meta?: {
    // memory
    scope?: string;
    confidence?: number;
    provenance?: { type?: string; ref?: string; locator?: string };
    sourceDocId?: string;   // vault document id — open the doc at `locator`
    locator?: string;       // e.g. "page 3" or a section/clause heading
    vaultName?: string;
    // legal
    url?: string;
    sourceId?: string;
    templateId?: string;
    // matter
    matterId?: string;
    // help (in-app Help Center article) — open at /main/help/<categorySlug>/<slug>
    slug?: string;
    categorySlug?: string;
    articleId?: string;
    // authority (case-law corpus): the verbatim paragraph is the snippet; meta
    // pins it to the exact judgment paragraph for the verify trail.
    provisionId?: string;
    anchor?: string;        // e.g. "para 23"
    citation?: string;      // neutral citation, e.g. [2020] UGSC 1
    court?: string;
    // legislation (statute corpus): verbatim section text (or Act-overview headnote)
    // is the snippet; `anchor` is the section (e.g. "s.41"), `statute` the Act label.
    statute?: string;
    // (web reuses `url`)
    [k: string]: any;
  };
}

// cleanCitationLabel strips the OCR/Markdown noise that corpus provisions carry —
// heading hashes, bold/italic/code marks, and "$^{1}$" footnote superscripts — so a
// citation title/label renders as clean plain text (e.g. "### **34. Computation**" →
// "34. Computation"). Used by the Sources footer and popover header.
export function cleanCitationLabel(s?: string): string {
  return (s ?? '')
    .replace(/\$\^\{[^}]*\}\$/g, '') // footnote superscripts
    .replace(/[#*_`]/g, '')          // heading / emphasis / code marks
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AiContext {
  matterIds?: string[];
  deadlineIds?: string[];
  userIds?: string[];
  engagementIds?: string[];
}

// A single structured context reference the user (or the floating dock) attaches to a
// chat — a matter, deadline, user or engagement. Selected chips are folded into
// AiContext at send time (see ChatSurface.buildContext) so the backend receives
// matterIds/deadlineIds/userIds/engagementIds. Shared here so the assistant dock can
// pre-seed the current page's context.
export type ContextType = 'matter' | 'deadline' | 'user' | 'engagement';
export interface ContextItem {
  type: ContextType;
  id: string;
  label: string;
  sublabel?: string;
}

export interface AiActionResult {
  /** Which write tool's result this carries (e.g. 'create_matter_draft'). */
  tool: string;
  /** The tool's structured output map (see ai/tools/*.go return values). */
  data: Record<string, any>;
}

/** A tool-produced structured object the CLIENT renders (the model never saw it
 *  verbatim). Kind discriminates the renderer; e.g. kind "workflow_def" carries a
 *  drafted workflow for the builder canvas. Mirrors ai/tools.Artifact in the backend. */
export interface AiArtifact {
  kind: string;
  data: any;
}

export interface AiResponse {
  type: 'text' | 'proposal' | 'error';
  content?: string;
  conversationId?: string;
  /** Set on a type=text reply when a tool emitted a client-only artifact this turn
   *  (e.g. apply_workflow → { kind: 'workflow_def', data: {...} }). */
  artifact?: AiArtifact;
  // proposal fields
  tool?: string;
  toolUseId?: string;
  input?: Record<string, any>;
  description?: string;
  preview?: ProposalPreview;
  pendingMessages?: AiMessage[];
  // Set on the text reply that follows a successful confirm of a write-tool —
  // lets the UI react (e.g. navigate to a newly created matter) without parsing
  // the assistant's prose.
  actionResult?: AiActionResult;
  // error field
  error?: string;
  // Verifiable sources this answer consulted (type=text only). Rendered as a
  // "Sources" footer; inline [[cite:<citeId>]] markers in `content` resolve here.
  citations?: AiCitation[];
  // Set when the credit pool+overage is exhausted: the reply was forced onto the
  // lighter model. The UI shows a "running on the lighter model" banner.
  degraded?: boolean;
  // Which model actually served this reply and the effective speed tier
  // ('auto' | 'fast' | 'deep'). Lets the UI show "ran on the fast model" and
  // explain why a round cost more or fewer credits.
  model?: string;
  tier?: 'auto' | 'fast' | 'deep';
  // Synthetic flag (HTTP 402): the credit limit was reached and AI is locked.
  // Not sent by the server as JSON — aiPost sets it so callers can lock the UI.
  blocked?: boolean;
  // Synthetic flag: the caller aborted the request mid-stream (the Stop button).
  // Set client-side in aiStreamPost; callers should silently drop the turn.
  aborted?: boolean;
}

// ── Proposal preview ───────────────────────────────────────────────────────────
// Backend-resolved, display-ready data attached to an approval proposal so the
// permission card can show names/dates/diffs instead of raw IDs. Built by
// `BuildProposalPreview` in practocore-backend/ai/preview.go — keep in sync.

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface DeadlineRef {
  id: string;
  name: string;
  date?: string;
  status?: string;
  matterId?: string;
  matterName?: string;
}

export interface MatterRef {
  id: string;
  name: string;
  caseNumber?: string;
}

export interface NotificationRecipient extends UserRef {
  // requested channels intersected with this recipient's notification preferences
  effectiveChannels: string[];
}

export interface MatterChange {
  label: string;
  op: 'add' | 'remove' | 'set' | 'update';
  before?: string;
  after?: string;
}

export interface ReassignPreview {
  kind: 'reassign';
  deadline?: DeadlineRef;
  currentAssignees?: UserRef[];
  newAssignees: UserRef[];
}
export interface BulkReassignPreview {
  kind: 'bulk_reassign';
  fromUser?: UserRef;
  toUser?: UserRef;
  matter?: MatterRef;
}
export interface NotificationPreview {
  kind: 'notification';
  title: string;
  body: string;
  bodyHtml?: string;
  channels: string[];
  recipients: NotificationRecipient[];
}
export interface AdjournPreview {
  kind: 'adjourn';
  deadline?: DeadlineRef;
  newDate: string;
  reason?: string;
  force?: boolean;
}
export interface FulfillPreview {
  kind: 'fulfill';
  deadline?: DeadlineRef;
  fulfilledDate?: string;
}
export interface MatterEditPreview {
  kind: 'matter_edit';
  matter: MatterRef;
  changes: MatterChange[];
}

export type FieldConfidence = 'high' | 'medium' | 'low';

export interface ExtractedField {
  id: string;
  label: string;
  value: any;
  required: boolean;
  confidence?: FieldConfidence;
}

export interface CreateMatterDraft {
  name: string;
  caseNumber?: string;
  /** Trigger date (ISO YYYY-MM-DD); semantics set by template.triggerDatePrompt. */
  date: string;
  court?: string;
  courtName?: string;
  judges?: UserRef[];
  opposingCounsel?: Array<Record<string, any>>;
  parties?: Record<string, Array<Record<string, any>>>;
  /** Map of role_id → role label, as declared in template.data.parties.roles[]. */
  partyRoles?: Record<string, string>;
  representing?: { role_id: string; party_member_ids: string[] } | null;
  members?: UserRef[];
  personal?: boolean;
}

export interface CreateMatterPreview {
  kind: 'create_matter';
  template: {
    id: string;
    name: string;
    /** Human-readable description of what the trigger date represents. */
    triggerDatePrompt?: string;
    triggerDateName?: string;
  };
  matter: CreateMatterDraft;
  fields: ExtractedField[];
  /** Warnings the user should notice before approving (missing required fields,
   *  unknown role IDs, model-supplied extraction notes). Backend omits this
   *  (serialises to null) when there are none. */
  warnings?: string[] | null;
}

export interface ReminderTouchpoint {
  /** Fire date (ISO YYYY-MM-DD). */
  date: string;
  daysBefore: number;
  title: string;
  body: string;
  /** Delivery time-of-day, 24h HH:MM in the user's timezone; empty = user default. */
  atTime?: string;
  /** True when this touchpoint already lies in the past and will be skipped. */
  past?: boolean;
}
export interface ReminderPreview {
  kind: 'reminder';
  /** 'personal' (no case) or 'case' (attached to a matter). */
  scope: 'personal' | 'case';
  /** Matter name, or "Personal" for standalone reminders. */
  matter: string;
  title: string;
  mode: 'single' | 'series';
  targetDate: string;
  /** Requested time-of-day, 24h HH:MM in the user's timezone; empty = user default. */
  atTime?: string;
  channels: string[];
  /** Who will be reminded. Empty = the current user (self). */
  recipients?: UserRef[];
  touchpoints: ReminderTouchpoint[];
}

// One body section in the generate_document outline (no paragraph text — just the
// shape, so the approval card stays compact). Mirrors previewGenerateDocument in
// practocore-backend/ai/preview.go.
export interface DocumentSectionOutline {
  heading: string;
  paragraphCount: number;
  numbered: boolean;
}
export interface DocumentCourtHeading {
  court: string;
  division: string;
  causeType: string;
  causeNumber: string;
  /** Flattened "NAMES — DESIGNATION" lines. */
  parties: string[];
}
export interface GenerateDocumentPreview {
  kind: 'generate_document';
  /** Document kind: plaint, contract, letter, affidavit, ... */
  docKind: string;
  title: string;
  date: string;
  sections: DocumentSectionOutline[];
  hasPrayer: boolean;
  prayerCount?: number;
  /** Present only for court documents. */
  courtHeading?: DocumentCourtHeading;
  /** The matter this will be filed under, if any. */
  matter?: MatterRef;
}

/** Skill Studio (SKILLS_V2 §C2): the firm-custom skill the assistant proposes to author. */
export interface ProposeSkillPreview {
  kind: 'propose_skill';
  /** Stable kebab-case id. */
  name: string;
  title: string;
  purpose: string;
  triggers: string;
  courtScope: string;
  instructions: string;
  toolBindings: string[];
  userInvocable: boolean;
  exampleCount?: number;
  /** True when this edits an existing firm skill of the same name (an overwrite). */
  isUpdate: boolean;
  /** The current status of the skill being overwritten, when isUpdate. */
  currentStatus?: string;
}

// Engagement Studio (ENGAGEMENT_STUDIO_OVERHAUL.md §3): the non-litigation
// playbook the assistant proposes to author. Mirrors
// previewProposeEngagementTemplate in practocore-backend/ai/preview.go.
export interface EngagementStageOutline {
  id: string;
  label: string;
  order: number;
}
export interface EngagementMilestoneOutline {
  label: string;
  stageId: string;
  /** Resolved stage label (empty for a stageless/lightweight playbook). */
  stageLabel: string;
  /** Plain due phrase, e.g. "14 day(s) before the target date". */
  due: string;
  reminder: boolean;
}
export interface EngagementFieldOutline {
  section: string;
  label: string;
  type: string;
  required: boolean;
}
export interface EngagementDocumentOutline {
  label: string;
  optional: boolean;
}
/** One recurring obligation rendered as a trust sentence via DescribeCompliance. */
export interface EngagementComplianceOutline {
  label: string;
  /** e.g. "Yearly, on the completion anniversary · reminders on · starts when completed". */
  schedule: string;
}
export interface ProposeEngagementTemplatePreview {
  kind: 'propose_engagement_template';
  name: string;
  description: string;
  /** True when the playbook has no stages (a lightweight advisory playbook). */
  lightweight: boolean;
  stages: EngagementStageOutline[];
  milestones: EngagementMilestoneOutline[];
  documents: EngagementDocumentOutline[];
  compliance: EngagementComplianceOutline[];
  fields: EngagementFieldOutline[];
  roles: string[];
  /** True when this updates one of the caller's existing playbooks of the same name. */
  isUpdate: boolean;
}

export interface GenericPreview {
  kind: 'generic';
}

export type ProposalPreview =
  | ReassignPreview
  | BulkReassignPreview
  | NotificationPreview
  | AdjournPreview
  | FulfillPreview
  | MatterEditPreview
  | CreateMatterPreview
  | ReminderPreview
  | GenerateDocumentPreview
  | ProposeSkillPreview
  | ProposeEngagementTemplatePreview
  | GenericPreview;

export interface AiConversationSummary {
  id: string;
  title: string;
  created: string;
  updated: string;
}

export interface AiConversation extends AiConversationSummary {
  messages: ConvDisplayMessage[];
  /** Serialized branch tree (conversation branching). Absent on conversations that
   *  predate branching or were never edited — callers fall back to `messages`. */
  tree?: unknown;
}

export interface AiConversationPage {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: AiConversationSummary[];
}

async function aiPost(path: string, body: object): Promise<AiResponse> {
  try {
    // Attach the caller's IANA timezone so server-side scheduling (e.g. reminders)
    // honours the user's local wall-clock time, not the server's.
    let timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* noop */ }
    const res = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': pb.authStore.token,
      },
      body: JSON.stringify({ timezone, ...body }),
    });
    // 402 = AI credit limit reached (gate hard-block). Flag it so the chat
    // surface can lock the composer and prompt a top-up rather than just erroring.
    if (res.status === 402) {
      let msg = 'AI credit limit reached. Top up to keep using AI.';
      try { const j = await res.json(); if (j?.message) msg = j.message; } catch { /* noop */ }
      return { type: 'error', error: msg, blocked: true };
    }
    if (!res.ok) return { type: 'error', error: `Request failed (${res.status})` };
    return await res.json() as AiResponse;
  } catch (e: any) {
    return { type: 'error', error: e?.message ?? 'Network error' };
  }
}

export function sendAiMessage(
  messages: AiMessage[],
  context?: AiContext,
  conversationId?: string,
  voiceMode?: boolean,
): Promise<AiResponse> {
  track('ai_chat_message_sent', {
    streaming: false,
    has_matter_context: (context?.matterIds?.length ?? 0) > 0,
    voice_mode: voiceMode ?? false,
    is_new_conversation: !conversationId,
  });
  return aiPost('/api/practocore/ai/chat', {
    messages,
    currentMatterId: context?.matterIds?.[0],
    matterIds: context?.matterIds,
    deadlineIds: context?.deadlineIds,
    userIds: context?.userIds,
    conversationId: conversationId ?? '',
    voiceMode: voiceMode ?? false,
  });
}

// ── Streaming chat ─────────────────────────────────────────────────────────────
// The chat endpoint streams activity steps (Server-Sent Events) while the tool loop
// runs, then a terminal `result` frame carrying the same AiResponse the blocking
// endpoint returns. We opt in with `Accept: text/event-stream`; the server falls back
// to plain JSON for clients that don't (voice mode, native), and so do we below if the
// response isn't actually an event stream.

/** One activity step surfaced mid-turn, e.g. { label: "Searching matters", detail: "Sebbi v Kato" }. */
export interface AiStreamStep {
  id: number;
  /** Underlying tool name ("" for synthetic bookend steps like "Assessing"/"Drafting"). */
  tool: string;
  label: string;
  detail?: string;
}

interface SseFrame {
  kind: 'step' | 'result' | 'text';
  step?: AiStreamStep;
  response?: AiResponse;
  /** Incremental assistant text delta (kind === 'text'); voice mode only. */
  text?: string;
}

/** Parse one SSE frame (its `data:` line(s)) into a typed frame, or null if malformed. */
function parseSseFrame(raw: string): SseFrame | null {
  const data = raw
    .split('\n')
    .filter(l => l.startsWith('data:'))
    .map(l => l.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as SseFrame;
  } catch {
    return null;
  }
}

export function sendAiMessageStream(
  messages: AiMessage[],
  context: AiContext | undefined,
  conversationId: string | undefined,
  opts: {
    onStep?: (step: AiStreamStep) => void;
    attachmentsMeta?: AiAttachmentMeta[];
    mode?: string;
    surface?: string;
    /** Floating-dock per-page partition key (e.g. "matter:<id>"). Stamped on the
     *  conversation so each page context keeps its own thread. Empty elsewhere. */
    contextKey?: string;
    /** Ambient page context (the dock's "The user is viewing matter X…"). Injected
     *  server-side as a volatile preamble — seen by the model each turn but never
     *  persisted or shown in the transcript. Empty off the dock. */
    pageContext?: string;
    /** Speed/cost tier: 'auto' (default), 'fast' (cheapest model) or 'deep'
     *  (premium model for hard synthesis). Forwarded to the backend router. */
    tier?: 'auto' | 'fast' | 'deep';
    /** Live builder-canvas definition, sent in workflow_studio mode so the model
     *  refines the current draft (incl. manual edits) rather than restarting. */
    workflowContext?: unknown;
    /** Abort signal for the Stop button — aborting resolves to { type:'aborted' }. */
    signal?: AbortSignal;
  } = {},
): Promise<AiResponse> {
  track('ai_chat_message_sent', {
    streaming: true,
    has_matter_context: (context?.matterIds?.length ?? 0) > 0,
    attachments: opts.attachmentsMeta?.length ?? 0,
    mode: opts.mode || 'chat',
    is_new_conversation: !conversationId,
  });
  return aiStreamPost(
    '/api/practocore/ai/chat',
    {
      messages,
      currentMatterId: context?.matterIds?.[0],
      matterIds: context?.matterIds,
      deadlineIds: context?.deadlineIds,
      userIds: context?.userIds,
      engagementIds: context?.engagementIds,
      conversationId: conversationId ?? '',
      voiceMode: false,
      attachmentsMeta: opts.attachmentsMeta ?? [],
      // Constrains the backend tool set + system prompt, e.g. "skill_studio".
      mode: opts.mode ?? '',
      // Per-page dock partition key — stamped on the conversation on create.
      contextKey: opts.contextKey ?? '',
      // Ambient page context → volatile preamble (not persisted, not displayed).
      pageContext: opts.pageContext ?? '',
      // Client surface, e.g. "word" — gates client-fulfilled tools (independent of mode).
      surface: opts.surface ?? '',
      // Speed/cost tier ('auto' default) — picks the serving model on the backend.
      tier: opts.tier ?? 'auto',
      workflowContext: opts.workflowContext ?? null,
    },
    opts.onStep,
    undefined,
    opts.signal,
  );
}

/**
 * Voice-mode streaming chat. Same SSE transport as sendAiMessageStream but flags
 * `voiceMode` (shorter spoken persona) and forwards incremental text deltas via
 * onText so the caller can pipeline TTS sentence-by-sentence as the model writes.
 */
export function sendAiMessageVoiceStream(
  messages: AiMessage[],
  context: AiContext | undefined,
  conversationId: string | undefined,
  opts: { onText?: (delta: string) => void; onStep?: (step: AiStreamStep) => void;
    mode?: string; contextKey?: string; pageContext?: string } = {},
): Promise<AiResponse> {
  return aiStreamPost(
    '/api/practocore/ai/chat',
    {
      messages,
      currentMatterId: context?.matterIds?.[0],
      matterIds: context?.matterIds,
      deadlineIds: context?.deadlineIds,
      userIds: context?.userIds,
      engagementIds: context?.engagementIds,
      conversationId: conversationId ?? '',
      voiceMode: true,
      mode: opts.mode ?? '',
      contextKey: opts.contextKey ?? '',
      pageContext: opts.pageContext ?? '',
    },
    opts.onStep,
    opts.onText,
  );
}

async function aiStreamPost(
  path: string,
  body: object,
  onStep?: (step: AiStreamStep) => void,
  onText?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<AiResponse> {
  try {
    let timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* noop */ }
    const res = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': pb.authStore.token,
      },
      body: JSON.stringify({ timezone, ...body }),
      signal,
    });

    // Credit gate / pre-flight errors arrive before the stream starts, as JSON.
    if (res.status === 402) {
      let msg = 'AI credit limit reached. Top up to keep using AI.';
      try { const j = await res.json(); if (j?.message) msg = j.message; } catch { /* noop */ }
      return { type: 'error', error: msg, blocked: true };
    }
    if (!res.ok) return { type: 'error', error: `Request failed (${res.status})` };

    const ctype = res.headers.get('Content-Type') || '';
    // Server (or a proxy) returned a single JSON object instead of a stream — read it plainly.
    if (!ctype.includes('text/event-stream') || !res.body) {
      return await res.json() as AiResponse;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: AiResponse | null = null;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = parseSseFrame(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        if (!frame) continue;
        if (frame.kind === 'step' && frame.step) onStep?.(frame.step);
        else if (frame.kind === 'text' && frame.text) onText?.(frame.text);
        else if (frame.kind === 'result' && frame.response) result = frame.response;
      }
    }
    return result ?? { type: 'error', error: 'The response ended unexpectedly. Please try again.' };
  } catch (e: any) {
    // The caller hit Stop — surface a quiet, dedicated outcome so the UI can drop
    // the turn without flashing an error bubble.
    if (e?.name === 'AbortError' || signal?.aborted) {
      return { type: 'error', error: '', aborted: true };
    }
    return { type: 'error', error: e?.message ?? 'Network error' };
  }
}

export function confirmAiProposal(
  proposal: AiResponse,
  approved: boolean,
  context?: AiContext,
  conversationId?: string,
  conversationMessages?: ConvDisplayMessage[],
  voiceMode?: boolean,
  attachmentsMeta?: AiAttachmentMeta[],
  mode?: string,
  contextKey?: string,
): Promise<AiResponse> {
  return aiPost('/api/practocore/ai/chat/confirm', {
    pendingMessages: proposal.pendingMessages ?? [],
    toolUseId: proposal.toolUseId ?? '',
    tool: proposal.tool ?? '',
    input: proposal.input ?? {},
    approved,
    matterIds: context?.matterIds,
    deadlineIds: context?.deadlineIds,
    userIds: context?.userIds,
    engagementIds: context?.engagementIds,
    conversationId: conversationId ?? '',
    conversationMessages: conversationMessages ?? [],
    voiceMode: voiceMode ?? false,
    attachmentsMeta: attachmentsMeta ?? [],
    mode: mode ?? '',
    contextKey: contextKey ?? '',
  });
}

// ── Prompt improvement ────────────────────────────────────────────────────────
// Takes the user's rough composer draft and rewrites it into a clearer, more
// effective prompt that steers the assistant toward the right tools. Mirrors
// practocore-backend/ai/improve_prompt.go. Runs on the lighter model and counts
// against the same AI credit pool.

export interface ImprovePromptResult {
  /** The rewritten prompt, or the original on any soft failure. */
  improved: string;
  /** Set when the credit pool is exhausted (HTTP 402) so the UI can prompt a top-up. */
  blocked?: boolean;
  /** Set on a hard failure so the caller can surface a toast and leave the draft as-is. */
  error?: string;
}

export async function improvePrompt(
  prompt: string,
  context?: AiContext,
): Promise<ImprovePromptResult> {
  try {
    let timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* noop */ }
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/improve-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': pb.authStore.token,
      },
      body: JSON.stringify({
        timezone,
        prompt,
        matterIds: context?.matterIds,
        deadlineIds: context?.deadlineIds,
        userIds: context?.userIds,
      }),
    });
    if (res.status === 402) {
      return { improved: prompt, blocked: true, error: 'AI credit limit reached. Top up to keep using AI.' };
    }
    if (!res.ok) return { improved: prompt, error: `Request failed (${res.status})` };
    const j = await res.json() as { type: string; improved?: string; error?: string };
    if (j.type === 'error' || !j.improved) {
      return { improved: prompt, error: j.error || 'Couldn\'t enhance the prompt.' };
    }
    return { improved: j.improved };
  } catch (e: any) {
    return { improved: prompt, error: e?.message ?? 'Network error' };
  }
}

// ── Conversation history ──────────────────────────────────────────────────────

async function aiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, {
      headers: { 'Authorization': pb.authStore.token },
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export function listConversations(page = 1, perPage = 20, mode = '', contextKey = ''): Promise<AiConversationPage | null> {
  // mode scopes the surface: '' = normal assistant (excludes studio threads),
  // 'skill_studio' = Skill Studio history. Mirrors the chat `mode` field.
  // contextKey further partitions within a surface (the floating dock's per-page
  // threads, e.g. "matter:<id>"); empty = no per-page scoping.
  const q = mode ? `&mode=${encodeURIComponent(mode)}` : '';
  const ck = contextKey ? `&contextKey=${encodeURIComponent(contextKey)}` : '';
  return aiGet(`/api/practocore/ai/conversations?page=${page}&perPage=${perPage}${q}${ck}`);
}

export function getConversation(id: string): Promise<AiConversation | null> {
  return aiGet(`/api/practocore/ai/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': pb.authStore.token },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function renameConversation(id: string, title: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/conversations/${id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Persist the conversation's branch tree (conversation branching). Best-effort:
// the flat active-path `messages` are saved by the chat turn itself; this stores
// the full tree so alternate branches survive a reload. A failure just means the
// thread reloads as a single branch.
export async function saveConversationTree(id: string, tree: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/conversations/${id}/tree`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
      body: JSON.stringify({ tree }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── AI credits / usage ──────────────────────────────────────────────────────
// Mirrors practocore-backend/ai/usage_endpoint.go UsageResponse. The shared org
// pool is the primary number (it's what gates access); your_used + per_seat_guide
// are the member view; per_member is admin-only and may be omitted.

export interface AiUsageMember {
  userId: string;
  name: string;
  email: string;
  used: number;
}

export interface AiUsage {
  pool_total: number;
  pool_used: number;
  your_used: number;
  seats: number;
  per_seat_guide: number;
  period_start: string;
  period_end: string;
  is_solo: boolean;
  is_admin: boolean;
  per_member?: AiUsageMember[];
  // Enforcement view (mirrors the credit gate).
  state: 'normal' | 'degraded' | 'blocked';
  overage_balance: number; // prepaid overage credits left
  hard_cap: number;        // burn level at which AI locks
}

export async function getAiUsage(): Promise<AiUsage> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/usage`, {
    method: 'GET',
    headers: { 'Authorization': pb.authStore.token },
  });
  if (!res.ok) {
    throw new Error(`Failed to load AI usage (${res.status})`);
  }
  return res.json();
}

// topUpCredits adds overage credits to the caller's billing holder (org for a
// team admin, else the solo user). `paid` records a purchased top-up vs a grant.
// Returns the new overage balance. Admin-only server-side for teams.
export async function topUpCredits(credits: number, paid = true): Promise<number> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/credits/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
    body: JSON.stringify({ credits, paid }),
  });
  if (!res.ok) {
    throw new Error(`Top-up failed (${res.status})`);
  }
  const j = await res.json();
  return j?.overage_balance ?? 0;
}
