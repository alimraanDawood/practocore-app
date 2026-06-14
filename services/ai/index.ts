import { pb, SERVER_URL } from '~/lib/pocketbase';

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

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string | AiContentBlock[];
}

// Broader message type used for conversation persistence (includes tool-event roles).
// Assistant turns may carry the activity steps that produced them so the "Worked for
// Ns" summary can be rehydrated when a saved conversation is reloaded.
export interface ConvDisplayMessage {
  role: string;
  content: string;
  steps?: AiStreamStep[];
  durationMs?: number;
}

export interface AiContext {
  matterIds?: string[];
  deadlineIds?: string[];
  userIds?: string[];
}

export interface AiActionResult {
  /** Which write tool's result this carries (e.g. 'create_matter_draft'). */
  tool: string;
  /** The tool's structured output map (see ai/tools/*.go return values). */
  data: Record<string, any>;
}

export interface AiResponse {
  type: 'text' | 'proposal' | 'error';
  content?: string;
  conversationId?: string;
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
  // Set when the credit pool+overage is exhausted: the reply was forced onto the
  // lighter model. The UI shows a "running on the lighter model" banner.
  degraded?: boolean;
  // Synthetic flag (HTTP 402): the credit limit was reached and AI is locked.
  // Not sent by the server as JSON — aiPost sets it so callers can lock the UI.
  blocked?: boolean;
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
   *  unknown role IDs, model-supplied extraction notes). */
  warnings: string[];
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
  | GenericPreview;

export interface AiConversationSummary {
  id: string;
  title: string;
  created: string;
  updated: string;
}

export interface AiConversation extends AiConversationSummary {
  messages: ConvDisplayMessage[];
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
  kind: 'step' | 'result';
  step?: AiStreamStep;
  response?: AiResponse;
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
  opts: { onStep?: (step: AiStreamStep) => void } = {},
): Promise<AiResponse> {
  return aiStreamPost(
    '/api/practocore/ai/chat',
    {
      messages,
      currentMatterId: context?.matterIds?.[0],
      matterIds: context?.matterIds,
      deadlineIds: context?.deadlineIds,
      userIds: context?.userIds,
      conversationId: conversationId ?? '',
      voiceMode: false,
    },
    opts.onStep,
  );
}

async function aiStreamPost(
  path: string,
  body: object,
  onStep?: (step: AiStreamStep) => void,
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
        else if (frame.kind === 'result' && frame.response) result = frame.response;
      }
    }
    return result ?? { type: 'error', error: 'The response ended unexpectedly. Please try again.' };
  } catch (e: any) {
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
    conversationId: conversationId ?? '',
    conversationMessages: conversationMessages ?? [],
    voiceMode: voiceMode ?? false,
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

export function listConversations(page = 1, perPage = 20): Promise<AiConversationPage | null> {
  return aiGet(`/api/practocore/ai/conversations?page=${page}&perPage=${perPage}`);
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
