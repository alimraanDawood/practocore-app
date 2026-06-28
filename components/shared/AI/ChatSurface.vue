<script lang="ts" setup>
import {
  Sparkles, Plus, MessageSquareText, History, Search, Globe,
  Loader2, Check, X, ChevronRight, ChevronDown, ChevronLeft, Pencil, Square, RotateCcw, ArrowUpIcon, Trash2,
  Briefcase, FileText, BookOpen, AtSign, Paperclip, Building2, Clock, User,
  Library, Zap, Gauge,
  Mic, MicOff, AudioLines, VolumeX, Headphones,
  type LucideIcon,
} from 'lucide-vue-next';
import {toast} from 'vue-sonner';
import ProposalCard from '~/components/shared/AI/ProposalCard.vue';
import {initials} from '~/components/shared/AI/proposals/theme';
import {
  sendAiMessageStream, sendAiMessageVoiceStream, confirmAiProposal, improvePrompt,
  getConversation, deleteConversation, listConversations, saveConversationTree, attachmentSha256, resolveAttachmentUrls, base64ToObjectUrl,
  listConversationAttachments, promoteConversationAttachments, vaultIngestProgress,
  type AiMessage, type AiContentBlock,
  type AiImageMediaType, type AiResponse, type AiContext, type AiAttachmentMeta,
  type ConvDisplayMessage, type ConvAttachment, type AiStreamStep, type AiCitation,
  type AiConversationSummary, type AiArtifact,
} from '~/services/ai';
import { useMediaQuery } from '@vueuse/core';
import MessageAttachments, { type AttachmentView } from '~/components/shared/AI/MessageAttachments.vue';
import DocumentPreview, { type PreviewDoc } from '~/components/shared/Vault/DocumentPreview.vue';
import {getMatters, getAllDeadlines} from '~/services/matters';
import {getOrganisationUsers} from '~/services/admin';

// ChatSurface is the single, reusable PractoAI chat — the whole conversational engine
// (streaming steps, proposals, attachments, citations, voice, history) lifted out of
// pages/main/index.vue so EVERY surface renders the identical chat instead of a
// bespoke clone. The /main home page and the workflow builder both mount this; the
// only differences are props:
//  • mode    — backend chat mode ('' = normal assistant, 'workflow_studio' = builder).
//              Constrains/extends the server tool set + system prompt AND partitions
//              conversation history so each surface keeps its own threads.
//  • surface — client surface (gates client-fulfilled tools); '' on web.
//  • seed    — an initial prompt auto-sent on mount (e.g. a builder deep link).
//  • workflowContext — the live builder-canvas definition, sent each turn so the
//              model refines the current draft.
// It emits `artifact` whenever a tool returns a client-only object (e.g. the builder
// canvas's drafted workflow). The empty (no-thread) state is an #empty slot, so /main
// fills it with its home dashboard and the builder with workflow examples.
// A client-fulfilled tool hook. Some tools (e.g. insert_into_document in the Word
// add-in) must be carried out by the CLIENT, not the server. `classify` decides what
// to do with such a proposal: 'auto' = fulfil + confirm immediately, no card; 'card'
// = show the normal approval card and fulfil on approve; null/undefined = default
// (show card, server fulfils on confirm). `fulfill` does the client-side work.
interface ChatClientTool {
  classify?: (resp: AiResponse) => 'auto' | 'card' | null | undefined;
  fulfill?: (resp: AiResponse) => Promise<void>;
}

const props = withDefaults(defineProps<{
  mode?: string;
  surface?: string;
  seed?: string;
  workflowContext?: unknown;
  clientTool?: ChatClientTool;
  // Returns ambient context to attach to the SENT payload of the next text turn
  // (e.g. the Word document selection). The bubble still shows only what the user
  // typed. Resolved at send time; return '' to attach nothing.
  contextProvider?: () => Promise<string>;
  // Click handler for "jump to passage" (doc:) links the assistant emits in the Word
  // surface — receives the verbatim snippet so the host can scroll the document to it.
  onLocate?: (text: string) => void;
}>(), { mode: '', surface: '', seed: '' });

const emit = defineEmits<{
  (e: 'artifact', artifact: AiArtifact): void;
}>();

// '' mode is the main assistant: it shares conversation history with the global
// sidebar (useAssistantHistory) and drives the URL `?c=`. Any other mode keeps its own
// in-component, mode-scoped history and never touches the route — so the builder's
// threads don't pollute the sidebar and vice versa.
const isMain = computed(() => !props.mode);

// ── Composer ────────────────────────────────────────────────────────────────
const draft = ref('');

// Speed/cost tier the user picks for chat (mirrors Chat.vue): 'auto' lets the
// backend choose, 'fast' is cheapest, 'deep' is most capable. Persisted locally.
type ChatTier = 'auto' | 'fast' | 'deep';
const TIERS: ChatTier[] = ['auto', 'fast', 'deep'];
const chatTier = ref<ChatTier>('auto');
onMounted(() => {
  const saved = localStorage.getItem('ai.chat.tier');
  if (saved === 'auto' || saved === 'fast' || saved === 'deep') chatTier.value = saved;
});
watch(chatTier, (t) => { if (import.meta.client) localStorage.setItem('ai.chat.tier', t); });
function cycleTier() { chatTier.value = TIERS[(TIERS.indexOf(chatTier.value) + 1) % TIERS.length]!; }
const tierLabel = computed(() => chatTier.value === 'fast' ? 'Fast' : chatTier.value === 'deep' ? 'Deep' : 'Auto');
const tierIcon = computed(() => chatTier.value === 'fast' ? Zap : chatTier.value === 'deep' ? Sparkles : Gauge);

/** Seed the composer with a prompt (exposed to the #empty slot's `ask`). */
function askAbout(prompt: string) {
  draft.value = prompt;
}

// Let a host page (e.g. the Word pane's quick actions) drive the chat imperatively:
// `ask()` prefills the composer; `send()` sends a turn now (still runs contextProvider,
// so the document selection rides along).
defineExpose({ ask: askAbout, send: (text: string) => send(text), conversationId });

// ── Chat engine ─────────────────────────────────────────────────────────────
type ToolEvent = { role: 'tool-event'; content: string; status: 'approved' | 'rejected' };
// `sendContent` lets a turn be DISPLAYED as one thing but SENT to the model as
// another — used by the Word surface to attach the document selection to the payload
// while the bubble shows only what the user typed. Absent = display == sent.
type DisplayAiMessage = AiMessage & {
  steps?: AiStreamStep[]; durationMs?: number; stepsOpen?: boolean; citations?: AiCitation[];
  attachments?: ConvAttachment[]; sendContent?: string; failed?: boolean; stopped?: boolean;
};
type ChatMessage = DisplayAiMessage | ToolEvent;

// sha256 → resolved open/download URL for attachments in the open conversation. Blob
// URLs for files sent this session; token URLs resolved from AiChatAttachments on reload.
const attachmentUrls = ref<Map<string, string>>(new Map());

/** Normalized chip views for a user turn, merging its refs with resolved URLs. */
function messageChips(msg: DisplayAiMessage): AttachmentView[] {
  return (msg.attachments ?? []).map(a => ({
    id: a.sha256,
    name: a.name ?? '',
    mime: a.mime ?? '',
    kind: a.kind ?? 'binary',
    size: a.size,
    url: attachmentUrls.value.get(a.sha256),
  }));
}

// ── Attachment preview (reuses the vault DocumentPreview viewer) ───────────────
const isDesktop = useMediaQuery('(min-width: 1024px)');
const previewTarget = ref<AttachmentView | null>(null);
const previewOpen = computed({
  get: () => !!previewTarget.value,
  set: (v) => { if (!v) previewTarget.value = null; },
});
const previewDoc = computed<PreviewDoc | null>(() => previewTarget.value
    ? { id: previewTarget.value.id, filename: previewTarget.value.name, file: previewTarget.value.name, mime: previewTarget.value.mime }
    : null);
function openPreview(att: AttachmentView) { previewTarget.value = att; }
// Thunk for DocumentPreview's resolveUrl — defined here because bare `Promise`
// isn't in template scope. The URL is already resolved (blob: live / token URL on reload).
const resolvePreviewUrl = () => Promise.resolve(previewTarget.value?.url ?? '');

/** Strip the bracketed attachment placeholders so the bubble shows only the caption. */
function stripAttachmentPlaceholders(text: string): string {
  return text.replace(/\[(?:image|file|PDF|document)(?::[^\]]*)?\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

// ── Vault promotion (Phase 3, suggest mode) ───────────────────────────────────
// When a conversation accumulates a lot of files, nudge the user to move them into
// the per-conversation vault so the assistant can keep referencing them without
// re-uploading. Suggest-only: a non-blocking banner with a one-click action.
const ATTACH_NUDGE_THRESHOLD = 5;
const promotion = ref<{ total: number; unpromoted: number; vaultId: string }>({ total: 0, unpromoted: 0, vaultId: '' });
const promotionDismissed = ref(false);
const promoting = ref(false);
const showPromotionNudge = computed(() =>
  !promotionDismissed.value && !promoting.value && promotion.value.unpromoted >= ATTACH_NUDGE_THRESHOLD);

// Refresh the promotion counters from the persisted attachment rows (which carry the
// `vault` link once promoted). Cheap SDK read; called after loads and sends.
async function refreshPromotion() {
  if (!conversationId.value) { promotion.value = { total: 0, unpromoted: 0, vaultId: '' }; return; }
  try {
    const rows = await listConversationAttachments(conversationId.value);
    promotion.value = {
      total: rows.length,
      unpromoted: rows.filter(r => !r.vault).length,
      vaultId: rows.find(r => r.vault)?.vault ?? '',
    };
  } catch { /* best-effort */ }
}

async function promoteAttachments() {
  if (!conversationId.value || promoting.value) return;
  promoting.value = true;
  try {
    const r = await promoteConversationAttachments(conversationId.value);
    if (r.error) { toast.error(r.error); return; }
    await refreshPromotion();
    // If files are being read, show the quiet progress ring + finish with a toast;
    // otherwise (stored-only, nothing to distil) just confirm the move.
    if (r.vault && (r.ingesting ?? 0) > 0) startIngestPoll(r.vault);
    else toast.success(r.message || 'Moved to the conversation vault.');
  } finally {
    promoting.value = false;
  }
}

// ── Ingestion progress (post-promotion) ───────────────────────────────────────
// Poll the per-conversation vault while the assistant distils the promoted files, so
// the user sees an unobtrusive "Processing n/m" ring and a toast when it's done.
const ingest = ref<{ done: number; total: number; active: boolean }>({ done: 0, total: 0, active: false });
let ingestTimer: ReturnType<typeof setInterval> | null = null;
let ingestDeadline: ReturnType<typeof setTimeout> | null = null;

function stopIngestPoll() {
  if (ingestTimer) { clearInterval(ingestTimer); ingestTimer = null; }
  if (ingestDeadline) { clearTimeout(ingestDeadline); ingestDeadline = null; }
  ingest.value.active = false;
}

async function pollIngest(vaultId: string) {
  const p = await vaultIngestProgress(vaultId);
  ingest.value = { done: p.done, total: p.total, active: p.total > 0 && p.done < p.total };
  if (p.total > 0 && p.done >= p.total) {
    stopIngestPoll();
    toast.success(`${p.total} ${p.total === 1 ? 'file is' : 'files are'} ready in the vault.`);
  }
}

function startIngestPoll(vaultId: string) {
  stopIngestPoll();
  ingest.value = { done: 0, total: 0, active: true };
  pollIngest(vaultId);
  ingestTimer = setInterval(() => pollIngest(vaultId), 2500);
  ingestDeadline = setTimeout(stopIngestPoll, 5 * 60 * 1000); // safety cap
}

onBeforeUnmount(stopIngestPoll);

// Conversation branching: the message tree owns every turn; `messages` is the
// active branch projected as a flat list, so the rest of the surface keeps treating
// the thread linearly. Editing an earlier user turn forks a sibling branch.
const branches = useChatBranches<ChatMessage>();
const messages = branches.messages;
const conversationId = ref('');
const pendingProposal = ref<AiResponse | null>(null);
const loading = ref(false);
const proposalLoading = ref(false);
const messagesEnd = ref<HTMLElement | null>(null);

// Stop button: the controller for the in-flight streaming turn. Aborting it makes
// the request resolve to { aborted:true }, which we drop silently.
let turnAbort: AbortController | null = null;
function stopTurn() {
  turnAbort?.abort();
}

// Inline edit of an earlier user turn → forks a new branch and resends.
const editingIndex = ref<number | null>(null);
const editDraft = ref('');
function startEdit(index: number, current: string) {
  if (loading.value) return;
  editingIndex.value = index;
  editDraft.value = current;
}
function cancelEdit() {
  editingIndex.value = null;
  editDraft.value = '';
}

// Live tool-activity steps streamed mid-turn; last one is in-flight (spinner).
const activeSteps = ref<AiStreamStep[]>([]);
const workStartedAt = ref(0);

const hasThread = computed(() => messages.value.length > 0);

// Only {role, content} turns are sent back to the model — drop tool-events + UI step metadata.
const apiMessages = computed<AiMessage[]>(() =>
    messages.value
        // Drop tool-events and the failed/stopped UI placeholders — the latter are
        // session-only notes, never part of the model's context.
        .filter((m): m is DisplayAiMessage => m.role !== 'tool-event' && !m.failed && !m.stopped)
        .map(m => ({role: m.role, content: m.sendContent ?? m.content})),
);

const convMessages = computed<ConvDisplayMessage[]>(() =>
    messages.value
        // failed/stopped placeholders aren't part of the saved transcript either.
        .filter(m => m.role === 'tool-event' || (!(m as DisplayAiMessage).failed && !(m as DisplayAiMessage).stopped))
        .map(m =>
            m.role === 'tool-event'
                ? {role: `tool-event:${m.status}`, content: m.content}
                : {role: m.role, content: messageText(m.content), attachments: m.attachments},
        ),
);

/** Flatten string|content-block content to a displayable string (attachments → placeholders). */
function messageText(content: AiMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map(b =>
      b.type === 'text' ? b.text
          : b.type === 'image' ? '[image]'
              : b.source?.type === 'text' ? '[document]'
                  : '[PDF]',
  ).join(' ');
}

function buildContext(): AiContext | undefined {
  if (selectedItems.value.length === 0) return undefined;
  return {
    matterIds: selectedItems.value.filter(i => i.type === 'matter').map(i => i.id),
    deadlineIds: selectedItems.value.filter(i => i.type === 'deadline').map(i => i.id),
    userIds: selectedItems.value.filter(i => i.type === 'user').map(i => i.id),
  };
}

function scrollToBottom() {
  nextTick(() => messagesEnd.value?.scrollIntoView({behavior: 'smooth'}));
}

function stepIcon(tool: string) {
  switch (tool) {
    case 'search_matters':
    case 'search_procedure':
    case 'find_applicable_procedure':
      return Search;
    case 'web_search':
      return Globe;
    case 'get_procedure_overview':
    case 'get_procedure_step':
    case 'get_procedure_citation':
    case 'list_legal_knowledge':
      return BookOpen;
    case 'load_skill':
    case 'list_skills':
      return Sparkles;
    case 'fetch_url':
      return FileText;
    case '':
      return Sparkles;
    default:
      return Briefcase;
  }
}

function formatDuration(ms: number): string {
  const secs = Math.max(1, Math.round(ms / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function formatToolName(tool: string): string {
  return tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function send(explicit?: string) {
  const text = (explicit ?? draft.value).trim();
  const hasAttachments = !explicit && attachments.value.length > 0;
  if ((!text && !hasAttachments) || loading.value) return;

  // Plain text turn, or a multimodal content-block array (attachments first, text as caption).
  let userContent: string | AiContentBlock[];
  const userAttachments: ConvAttachment[] = [];
  if (hasAttachments) {
    const blocks: AiContentBlock[] = [];
    for (const a of attachments.value) {
      // Build the transmitted `data` string once, then hash it for the metadata
      // side-channel so the backend can name + dedup the persisted file.
      let block: AiContentBlock;
      let data: string;
      if (a.kind === 'text') {
        // Prefix the filename so the model knows the document's name/type.
        data = `# ${a.name}\n\n${a.text ?? ''}`;
        block = {type: 'document', source: {type: 'text', media_type: 'text/plain', data}};
      } else {
        data = a.base64 as string;
        block = a.mime === 'application/pdf'
            ? {type: 'document', source: {type: 'base64', media_type: 'application/pdf', data}}
            : {type: 'image', source: {type: 'base64', media_type: a.mime as AiImageMediaType, data}};
      }
      blocks.push(block);
      const sha256 = await attachmentSha256(data);
      sentAttachmentsMeta.value.push({sha256, name: a.name, mime: a.mime, kind: a.kind, size: a.size});
      userAttachments.push({sha256, name: a.name, mime: a.mime, kind: a.kind, size: a.size});
      // Resolve a usable URL now so chips preview immediately (before any reload).
      // Object URLs (not data: URLs) so the previewer's XHR fetch works reliably.
      const url = a.kind === 'text'
          ? URL.createObjectURL(new Blob([a.text ?? ''], {type: a.mime || 'text/plain'}))
          : base64ToObjectUrl(a.base64 as string, a.mime);
      if (url && sha256) attachmentUrls.value.set(sha256, url);
    }
    blocks.push({type: 'text', text: text || 'Help me with this.'});
    userContent = blocks;
    attachments.value = [];
  } else {
    userContent = text;
  }

  // Host-supplied ambient context (e.g. the Word document selection): attached to the
  // SENT payload only, so the bubble shows just what the user typed. Text turns only.
  let sendContent: string | undefined;
  if (!hasAttachments && props.contextProvider) {
    try {
      const ctx = (await props.contextProvider())?.trim();
      if (ctx) sendContent = `${ctx}\n\n${text}`;
    } catch { /* selection unavailable — send the plain text */ }
  }

  dropTrailingPlaceholder();
  branches.append({role: 'user', content: userContent, sendContent, attachments: userAttachments.length ? userAttachments : undefined});
  draft.value = '';
  pendingProposal.value = null;
  loading.value = true;
  activeSteps.value = [];
  workStartedAt.value = Date.now();
  scrollToBottom();

  turnAbort = new AbortController();
  const response = await sendAiMessageStream(apiMessages.value, buildContext(), conversationId.value || undefined, {
    onStep: (s) => {
      activeSteps.value = [...activeSteps.value, s];
      scrollToBottom();
    },
    attachmentsMeta: sentAttachmentsMeta.value,
    mode: props.mode,
    surface: props.surface,
    tier: chatTier.value,
    workflowContext: props.workflowContext,
    signal: turnAbort.signal,
  });
  turnAbort = null;

  const elapsedMs = Date.now() - workStartedAt.value;
  const turnSteps = activeSteps.value.filter(s => s.tool);
  activeSteps.value = [];
  loading.value = false;

  applyResponse(response, turnSteps, elapsedMs);
  scrollToBottom();
}

function applyResponse(response: AiResponse, turnSteps: AiStreamStep[] = [], elapsedMs = 0) {
  // The user hit Stop: mark the turn as stopped (neutral, not an error) and offer a
  // Retry. The preceding user turn stays in place so retry resends from it.
  if (response.aborted) {
    // Session-only placeholder (not persisted) — it reads as a note and offers Retry.
    branches.append({ role: 'assistant', content: 'Response stopped.', stopped: true });
    return;
  }
  // Surface any tool-produced client artifact (e.g. the builder canvas's drafted
  // workflow) to the parent, regardless of reply type.
  if (response.artifact) emit('artifact', response.artifact);
  if (response.type === 'text') {
    branches.append({
      role: 'assistant',
      content: response.content ?? '',
      steps: turnSteps.length ? turnSteps : undefined,
      durationMs: turnSteps.length ? elapsedMs : undefined,
      stepsOpen: false,
      citations: response.citations?.length ? response.citations : undefined,
    });
    if (response.conversationId) {
      const isNew = !conversationId.value;
      conversationId.value = response.conversationId;
      if (isNew) {
        // Reflect the freshly-created conversation in the URL (replace, so the
        // empty-chat URL isn't pushed onto history) and pull it into the list. Only
        // the main assistant owns the URL; other modes keep selection in-memory.
        if (isMain.value) router.replace({ query: { c: response.conversationId } });
        refreshHistory(true);
      } else if (historyLoaded.value) {
        const idx = conversations.value.findIndex(c => c.id === response.conversationId);
        if (idx >= 0) conversations.value[idx]!.updated = new Date().toISOString();
      }
      // Refresh the promotion nudge once the turn (and its attachment persistence) lands.
      if (sentAttachmentsMeta.value.length) refreshPromotion();
    }
    persistTree();
  } else if (response.type === 'proposal') {
    // A client-fulfilled tool the host wants applied silently (e.g. the Word
    // add-in writing the AI's text into the document) skips the approval card.
    if (props.clientTool?.classify?.(response) === 'auto') { void autoFulfillProposal(response); return; }
    pendingProposal.value = response;
  } else {
    // Session-only error placeholder (not persisted) — offers Retry.
    branches.append({role: 'assistant', content: response.error ?? 'Something went wrong.', failed: true});
  }
}

// If the latest turn is a session-only failed/stopped placeholder, drop it before
// the next action so it never enters the persisted tree or the model's context.
function dropTrailingPlaceholder() {
  const last = messages.value[messages.value.length - 1] as DisplayAiMessage | undefined;
  if (last && (last.failed || last.stopped)) branches.popActive();
}

// Retry a failed turn: drop the error bubble (now the active leaf) and resend from
// the preceding user turn, which is left in place. The new reply replaces it.
async function retryTurn() {
  if (loading.value) return;
  branches.popActive();
  pendingProposal.value = null;
  loading.value = true;
  activeSteps.value = [];
  workStartedAt.value = Date.now();
  scrollToBottom();

  turnAbort = new AbortController();
  const response = await sendAiMessageStream(apiMessages.value, buildContext(), conversationId.value || undefined, {
    onStep: (s) => { activeSteps.value = [...activeSteps.value, s]; scrollToBottom(); },
    attachmentsMeta: sentAttachmentsMeta.value,
    mode: props.mode,
    surface: props.surface,
    workflowContext: props.workflowContext,
    signal: turnAbort.signal,
  });
  turnAbort = null;

  const elapsedMs = Date.now() - workStartedAt.value;
  const turnSteps = activeSteps.value.filter(s => s.tool);
  activeSteps.value = [];
  loading.value = false;

  applyResponse(response, turnSteps, elapsedMs);
  scrollToBottom();
}

// Persist the branch tree so alternate branches survive a reload. Best-effort and
// debounced; the flat active path is already saved by the chat turn itself. Only
// the main assistant persists (other modes keep branches in-memory for the session).
let treeSaveTimer: ReturnType<typeof setTimeout> | null = null;
function persistTree() {
  if (!conversationId.value || !isMain.value) return;
  if (treeSaveTimer) clearTimeout(treeSaveTimer);
  const id = conversationId.value;
  treeSaveTimer = setTimeout(() => {
    void saveConversationTree(id, branches.serialize());
  }, 400);
}

// Edit an earlier user turn: fork a sibling branch carrying the new text and resend
// from there. The previous branch (and its replies) is preserved and reachable via
// the branch switcher arrows.
async function saveEdit(index: number) {
  const text = editDraft.value.trim();
  cancelEdit();
  if (!text || loading.value) return;
  branches.fork(index, { role: 'user', content: text });
  pendingProposal.value = null;
  loading.value = true;
  activeSteps.value = [];
  workStartedAt.value = Date.now();
  scrollToBottom();

  turnAbort = new AbortController();
  const response = await sendAiMessageStream(apiMessages.value, buildContext(), conversationId.value || undefined, {
    onStep: (s) => { activeSteps.value = [...activeSteps.value, s]; scrollToBottom(); },
    mode: props.mode,
    surface: props.surface,
    workflowContext: props.workflowContext,
    signal: turnAbort.signal,
  });
  turnAbort = null;

  const elapsedMs = Date.now() - workStartedAt.value;
  const turnSteps = activeSteps.value.filter(s => s.tool);
  activeSteps.value = [];
  loading.value = false;

  applyResponse(response, turnSteps, elapsedMs);
  scrollToBottom();
}

// Branch switcher: move to the previous/next sibling of the user turn at `index`.
function switchBranch(index: number, dir: -1 | 1) {
  if (loading.value) return;
  cancelEdit();
  branches.switchSibling(index, dir);
  persistTree();
  scrollToBottom();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

// ── Conversational voice mode ─────────────────────────────────────────────────
// A full-duplex-ish loop on top of the same message/conversation state as text
// chat: listen → think → speak → listen. The reply is synthesized sentence-by-
// sentence (fast first word) and the user can cut in at any point — either by
// talking over it (barge-in) or tapping the orb. Web/desktop only for now; the
// composer mic button is hidden where streaming STT isn't supported.
const {
  isListening, isTranscribing, transcript, audioLevel, micError, sttSupported,
  startListening, stopListening,
  isSpeaking, caption, stopSpeaking, unlockAudio,
  beginStreamingSpeech, pushSpeechDelta, endStreamingSpeech, awaitStreamingDone,
  armBargeIn, disarmBargeIn,
} = useSpeech();

const voiceOpen = ref(false);
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
const voiceState = ref<VoiceState>('idle');

// Barge-in lets you talk over the assistant, but on open speakers the mic hears
// the assistant's OWN voice and treats it as a reply (a feedback loop). So it's
// off by default and only safe with headphones; tap-the-orb interrupt always
// works. Persisted so the choice sticks.
const bargeInEnabled = ref(false);
onMounted(() => {
  try { bargeInEnabled.value = localStorage.getItem('practoai_bargein') === '1'; } catch {}
});
function toggleBargeIn() {
  bargeInEnabled.value = !bargeInEnabled.value;
  try { localStorage.setItem('practoai_bargein', bargeInEnabled.value ? '1' : '0'); } catch {}
  if (!bargeInEnabled.value) disarmBargeIn();
}

function isUsableTranscript(t: string): boolean {
  return t.trim().replace(/[.,!?…\s]/g, '').length >= 2;
}

// ── Simple dictation (composer) ───────────────────────────────────────────────
// For now the mic button just transcribes speech into the prompt box rather than
// opening the full conversational voice mode (kept below, but dormant — we'll
// revisit it when the round-trip feels good enough). Tap to record, tap to stop;
// the live transcript fills the draft, appended after whatever's already typed.
const dictating = ref(false);        // recording or processing a dictation
const dictateCancelled = ref(false); // user discarded this take
let dictateBase = '';                // draft text that predates this take

// Recording FX state: an rAF loop drives both the running timer and the waveform
// so the bars keep a gentle motion even in silence (audioLevel alone freezes when
// the room is quiet). Frozen the moment recording stops; the processing state has
// its own animation.
const recordingMs = ref(0);
const waveTick = ref(0);
let waveRaf: number | null = null;
let recStart = 0;

function startRecFx() {
  recStart = performance.now();
  recordingMs.value = 0;
  const loop = () => {
    waveTick.value = performance.now();
    recordingMs.value = performance.now() - recStart;
    waveRaf = requestAnimationFrame(loop);
  };
  loop();
}
function stopRecFx() {
  if (waveRaf !== null) { cancelAnimationFrame(waveRaf); waveRaf = null; }
}

const recTime = computed(() => {
  const s = Math.floor(recordingMs.value / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

// Per-bar height for the live waveform: a travelling sine for idle shimmer, scaled
// up by the live mic level so speech visibly drives the bars.
function dictBarHeight(i: number): number {
  const level = isListening.value ? audioLevel.value / 100 : 0;
  const phase = i * 0.45 + waveTick.value / 220;
  const shimmer = Math.sin(phase) * 0.5 + 0.5; // 0..1
  return 3 + shimmer * 4 + level * 24 * (0.35 + 0.65 * shimmer);
}

function toggleDictation() {
  if (dictating.value) return;
  if (!sttSupported.value) {
    toast.error('Dictation needs microphone access on a secure (https) connection.');
    return;
  }
  dictateBase = draft.value.trim();
  dictateCancelled.value = false;
  dictating.value = true;
  startRecFx();
  startListening();
}

function stopDictation() {
  if (isListening.value) stopListening();
}

function cancelDictation() {
  dictateCancelled.value = true;
  draft.value = dictateBase; // undo any live-filled text
  if (isListening.value) stopListening();
  else { dictating.value = false; stopRecFx(); }
}

// Live-fill the draft as the (web) transcript streams in.
watch(transcript, (t) => {
  if (dictating.value && !dictateCancelled.value && t) {
    draft.value = dictateBase ? `${dictateBase} ${t}` : t;
  }
});

// Freeze the timer/waveform the instant recording stops (processing has its own UI).
watch(isListening, (now) => {
  if (!now && dictating.value) stopRecFx();
});

onBeforeUnmount(stopRecFx);

// Entry point for the full conversational voice mode. Intentionally retained but
// not wired to any control for now — the composer mic does simple dictation
// instead (see toggleDictation). We'll re-attach this when voice mode is ready.
function enterVoice() {
  if (!sttSupported.value) {
    toast.error('Voice needs microphone access on a secure (https) connection.');
    return;
  }
  unlockAudio(); // must run on the user gesture before any async audio
  voiceOpen.value = true;
  beginListening();
}
void enterVoice; // kept for the upcoming voice-mode revisit; avoids dead-symbol noise

function exitVoice() {
  voiceOpen.value = false;
  voiceState.value = 'idle';
  stopListening();
  stopSpeaking();
  disarmBargeIn();
}

// `settleMs` lets the assistant's audio fully clear the room before the mic opens,
// so a speaker echo of the last word isn't transcribed as the user's reply.
function beginListening(settleMs = 0) {
  if (!voiceOpen.value) return;
  stopSpeaking();
  disarmBargeIn();
  voiceState.value = 'listening';
  if (settleMs > 0) {
    setTimeout(() => { if (voiceOpen.value && voiceState.value === 'listening') startListening(); }, settleMs);
  } else {
    startListening();
  }
}

// User cuts in while the assistant is talking — drop playback and listen.
function onBargeIn() {
  if (!voiceOpen.value) return;
  beginListening();
}

// Tap the orb: interrupt if speaking, otherwise toggle the mic.
function tapOrb() {
  if (voiceState.value === 'thinking') return;
  if (isSpeaking.value) { beginListening(); return; }
  if (isListening.value) stopListening();
  else beginListening();
}

async function runVoiceTurn(text: string) {
  voiceState.value = 'thinking';
  branches.append({ role: 'user', content: text });
  scrollToBottom();

  // Stream the reply: speak sentences as the model writes them (LLM→TTS pipeline).
  // The first text delta flips us into 'speaking'; arm barge-in once we're talking.
  beginStreamingSpeech();
  let started = false;
  const response = await sendAiMessageVoiceStream(
    apiMessages.value, buildContext(), conversationId.value || undefined,
    {
      onText: (delta) => {
        if (!voiceOpen.value) return;
        if (!started) {
          started = true;
          voiceState.value = 'speaking';
          if (bargeInEnabled.value) armBargeIn(onBargeIn);
        }
        pushSpeechDelta(delta);
      },
    },
  );
  if (!voiceOpen.value) return; // user left mid-flight

  applyResponse(response);
  scrollToBottom();

  if (response.type === 'text' && response.content?.trim()) {
    // If nothing streamed (e.g. proxy collapsed to JSON), speak the full text now.
    if (!started) {
      voiceState.value = 'speaking';
      if (bargeInEnabled.value) armBargeIn(onBargeIn);
      pushSpeechDelta(response.content);
    }
    endStreamingSpeech();
    await awaitStreamingDone();
    disarmBargeIn();
    // Finished speaking uninterrupted → hand the turn back. Without barge-in (open
    // speakers) wait a beat so the tail doesn't echo into the mic.
    if (voiceOpen.value && voiceState.value === 'speaking') beginListening(bargeInEnabled.value ? 0 : 350);
  } else {
    // Proposal / error: nothing to read aloud, so just reopen the mic.
    stopSpeaking();
    beginListening();
  }
}

// End of an STT turn (web + native both flip isTranscribing true→false at the end).
watch(isTranscribing, (now, was) => {
  if (!was || now) return;
  // Dictation: commit the final transcript (native fills it only here), unless the
  // take was cancelled — then leave the pre-existing draft untouched.
  if (dictating.value) {
    stopRecFx();
    if (!dictateCancelled.value) {
      const t = transcript.value.trim();
      if (t) draft.value = dictateBase ? `${dictateBase} ${t}` : t;
    }
    dictating.value = false;
    dictateCancelled.value = false;
    return;
  }
  // Conversational voice mode (dormant for now).
  if (!voiceOpen.value || voiceState.value !== 'listening') return;
  const t = transcript.value.trim();
  if (isUsableTranscript(t)) runVoiceTurn(t);
  else beginListening(); // heard nothing usable — keep the mic open
});

watch(micError, (err) => {
  if (!err) return;
  if (dictating.value) { toast.error(err); dictating.value = false; }
  if (voiceOpen.value) { toast.error(err); voiceState.value = 'idle'; }
});

// ── Orb visualisation ─────────────────────────────────────────────────────────
function barHeight(i: number): number {
  if (!isListening.value) return 4;
  const wave = Math.abs(Math.sin((i + 1) * 0.9 + Date.now() / 200));
  return Math.max(4, (audioLevel.value / 100) * 38 * wave + 4);
}
const outerRingScale = computed(() => {
  if (voiceState.value === 'listening') return 1 + (audioLevel.value / 100) * 0.5;
  if (voiceState.value === 'speaking') return 1.25;
  return 1;
});
const innerRingScale = computed(() => {
  if (voiceState.value === 'listening') return 1 + (audioLevel.value / 100) * 0.28;
  if (voiceState.value === 'speaking') return 1.12;
  return 1;
});

// ── Proposals ───────────────────────────────────────────────────────────────
function dismissProposal() {
  if (pendingProposal.value) {
    branches.append({
      role: 'tool-event',
      content: formatToolName(pendingProposal.value.tool ?? ''),
      status: 'rejected'
    });
    persistTree();
  }
  pendingProposal.value = null;
}

async function approveProposal() {
  if (!pendingProposal.value || proposalLoading.value) return;
  proposalLoading.value = true;
  const proposal = pendingProposal.value;
  pendingProposal.value = null;

  // For a 'card' client-fulfilled tool, do the client-side work (e.g. pour the
  // generated document into the Word doc) BEFORE confirming. Abort on failure so we
  // don't tell the model it succeeded.
  if (props.clientTool?.classify?.(proposal) === 'card' && props.clientTool.fulfill) {
    try {
      await props.clientTool.fulfill(proposal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not apply that to the document.');
      proposalLoading.value = false;
      return;
    }
  }

  branches.append({role: 'tool-event', content: formatToolName(proposal.tool ?? ''), status: 'approved'});
  loading.value = true;
  scrollToBottom();

  const response = await confirmAiProposal(
      proposal, true, buildContext(),
      conversationId.value || undefined,
      convMessages.value,
      false,
      sentAttachmentsMeta.value,
      props.mode,
  );
  loading.value = false;
  proposalLoading.value = false;

  applyResponse(response);
  scrollToBottom();
}

// Auto-fulfil a client tool the host marked 'auto' (no approval card): apply it on
// the client, then confirm so the model can compose its closing message. On a client
// failure we confirm with approved=false so the model is told it didn't happen.
async function autoFulfillProposal(proposal: AiResponse) {
  proposalLoading.value = true;
  let ok = true;
  try {
    await props.clientTool?.fulfill?.(proposal);
  } catch (e) {
    ok = false;
    toast.error(e instanceof Error ? e.message : 'Could not apply that to the document.');
  }
  branches.append({
    role: 'tool-event',
    content: formatToolName(proposal.tool ?? ''),
    status: ok ? 'approved' : 'rejected',
  });
  loading.value = true;
  scrollToBottom();

  const response = await confirmAiProposal(
      proposal, ok, buildContext(),
      conversationId.value || undefined,
      convMessages.value,
      false,
      sentAttachmentsMeta.value,
      props.mode,
  );
  loading.value = false;
  proposalLoading.value = false;

  applyResponse(response);
  scrollToBottom();
}

// ── Attachments (PDF + images + text/Markdown) ──────────────────────────────
// kind 'binary' = image/PDF (base64); kind 'text' = Markdown/plain-text/source
// files, carried as raw UTF-8 in `text` and sent as an Anthropic text document.
interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: 'binary' | 'text';
  base64?: string;
  dataUrl?: string;
  text?: string;
}

const attachments = ref<Attachment[]>([]);
// Metadata (name/mime/hash) for every file sent in this session, accumulated across
// turns and re-sent each call. The backend dedups by hash, so resends are harmless;
// carrying the full set means a turn whose first leg was a proposal still names its
// files on the confirm leg. Reset when the conversation is cleared/switched.
const sentAttachmentsMeta = ref<AiAttachmentMeta[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES: AiImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Text/Markdown/source files. Browsers report an unreliable (often empty) MIME for
// .md, so we also match on extension. These are sent as text document blocks.
const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.text', '.csv', '.json', '.log', '.rtf'];

function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (TEXT_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
  const t = file.type;
  return t.startsWith('text/') || t === 'application/json' || t === 'application/markdown';
}

const totalAttachmentBytes = computed(() => attachments.value.reduce((s, a) => s + a.size, 0));

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve({base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, dataUrl});
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function isAcceptedFile(file: File): boolean {
  return file.type === 'application/pdf'
      || (ACCEPTED_IMAGE_TYPES as string[]).includes(file.type)
      || isTextFile(file);
}

async function addFiles(files: File[] | FileList) {
  for (const file of Array.from(files)) {
    if (!isAcceptedFile(file)) {
      toast('Unsupported file', {description: `${file.name} — PDFs, images, and text/Markdown only.`});
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast('File too large', {description: `${file.name} is ${formatBytes(file.size)}. Max ${formatBytes(MAX_FILE_BYTES)}.`});
      continue;
    }
    if (totalAttachmentBytes.value + file.size > MAX_TOTAL_BYTES) {
      toast('Attachment limit reached', {description: `Total must stay under ${formatBytes(MAX_TOTAL_BYTES)}.`});
      continue;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      if (isTextFile(file)) {
        const text = await file.text();
        attachments.value.push({
          id,
          name: file.name,
          mime: file.type || 'text/markdown',
          size: file.size,
          kind: 'text',
          text
        });
      } else {
        const {base64, dataUrl} = await fileToBase64(file);
        attachments.value.push({
          id,
          name: file.name,
          mime: file.type,
          size: file.size,
          kind: 'binary',
          base64,
          dataUrl
        });
      }
    } catch (err: any) {
      toast('Could not read file', {description: file.name + (err?.message ? ` — ${err.message}` : '')});
    }
  }
}

async function onFilesChosen(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  await addFiles(input.files);
  input.value = '';
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id);
}

function openFilePicker() {
  fileInput.value?.click();
}

// ── Context picker (matters / deadlines / lawyers) ──────────────────────────
type ContextType = 'matter' | 'deadline' | 'user';

interface ContextItem {
  type: ContextType;
  id: string;
  label: string;
  sublabel?: string
}

const selectedItems = ref<ContextItem[]>([]);
const contextIcons: Record<ContextType, LucideIcon> = {matter: Building2, deadline: Clock, user: User};

const contextDrawerOpen = ref(false);
const contextTab = ref<ContextType>('matter');
const contextSearch = ref('');
const mattersList = ref<{ id: string; name: string; caseNumber: string }[]>([]);
const deadlinesList = ref<{ id: string; name: string; matterName: string }[]>([]);
const usersList = ref<{ id: string; name: string; role: string; avatar?: string }[]>([]);
const contextLoading = ref(false);

watch(contextDrawerOpen, async (isOpen) => {
  if (!isOpen) {
    contextSearch.value = '';
    return;
  }
  if (mattersList.value.length > 0) return;
  contextLoading.value = true;
  try {
    const [mattersRes, deadlinesRes, usersRes] = await Promise.all([
      getMatters(1, 100, {sort: '-created'}),
      getAllDeadlines({
        sort: '-date',
        filter: "status = 'pending'",
        expand: 'matter',
        fields: 'id,name,date,expand.matter.name'
      }),
      getOrganisationUsers(1, 100, {}),
    ]);
    mattersList.value = (mattersRes.items ?? []).map((m: any) => ({id: m.id, name: m.name, caseNumber: m.caseNumber}));
    deadlinesList.value = (deadlinesRes ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      matterName: d.expand?.matter?.name ?? ''
    }));
    usersList.value = (usersRes.items ?? []).map((u: any) => ({
      id: u.id,
      name: u.name,
      role: u.organisationRole ?? u.role ?? '',
      avatar: u.avatar
    }));
  } finally {
    contextLoading.value = false;
  }
});

const q = computed(() => contextSearch.value.toLowerCase());
const filteredMatters = computed(() => q.value ? mattersList.value.filter(m => m.name.toLowerCase().includes(q.value) || m.caseNumber?.toLowerCase().includes(q.value)) : mattersList.value);
const filteredDeadlines = computed(() => q.value ? deadlinesList.value.filter(d => d.name.toLowerCase().includes(q.value) || d.matterName.toLowerCase().includes(q.value)) : deadlinesList.value);
const filteredUsers = computed(() => q.value ? usersList.value.filter(u => u.name.toLowerCase().includes(q.value)) : usersList.value);

function isSelected(id: string) {
  return selectedItems.value.some(i => i.id === id);
}

function toggleItem(item: ContextItem) {
  const idx = selectedItems.value.findIndex(i => i.id === item.id);
  if (idx >= 0) selectedItems.value.splice(idx, 1);
  else selectedItems.value.push(item);
}

function removeItem(id: string) {
  selectedItems.value = selectedItems.value.filter(i => i.id !== id);
}

// ── Prompt enhancement ──────────────────────────────────────────────────────
const enhancing = ref(false);
const canEnhance = computed(() => draft.value.trim().length > 0 && !enhancing.value && !loading.value);
const canSend = computed(() => (draft.value.trim().length > 0 || attachments.value.length > 0) && !loading.value);

async function enhancePrompt() {
  const original = draft.value.trim();
  if (!original || enhancing.value || loading.value) return;
  enhancing.value = true;
  try {
    const result = await improvePrompt(original, buildContext());
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.improved.trim() === original) {
      toast('Prompt already looks clear — left it as is.');
      return;
    }
    draft.value = result.improved;
    toast('Prompt enhanced', {
      action: {
        label: 'Undo', onClick: () => {
          draft.value = original;
        }
      }
    });
  } finally {
    enhancing.value = false;
  }
}

// ── Conversation history (left rail) ────────────────────────────────────────
// MAIN mode shares the list with the global sidebar (useAssistantHistory) and is
// URL-driven (`?c=<id>`). Any other mode (e.g. the workflow builder) keeps its OWN
// mode-scoped, in-component list so its threads don't leak into the sidebar, and
// never touches the route — selection is purely in-memory.
const sharedHistory = useAssistantHistory();
const localConversations = ref<AiConversationSummary[]>([]);
const localLoading = ref(false);
const localLoaded = ref(false);
const router = useRouter();
const route = useRoute();

const conversations = computed<AiConversationSummary[]>(() => isMain.value ? sharedHistory.conversations.value : localConversations.value);
const historyLoading = computed(() => isMain.value ? sharedHistory.loading.value : localLoading.value);
const historyLoaded = computed(() => isMain.value ? sharedHistory.loaded.value : localLoaded.value);

async function refreshHistory(force = false) {
  if (isMain.value) return sharedHistory.refresh(force);
  if (localLoading.value) return;
  if (localLoaded.value && !force) return;
  localLoading.value = true;
  try {
    const page = await listConversations(1, 30, props.mode);
    localConversations.value = page?.items ?? [];
    localLoaded.value = true;
  } finally {
    localLoading.value = false;
  }
}

// Open a conversation. Main funnels through the URL (one source of truth shared with
// the sidebar); other modes load it directly in-memory.
function selectConversation(id: string) {
  if (isMain.value) router.push({ query: { c: id } });
  else loadConversation(id);
}

async function loadConversation(id: string) {
  if (conversationId.value === id) return;
  const conv = await getConversation(id);
  if (!conv) return;
  const flat = (conv.messages ?? []).map((m): ChatMessage => {
    if (m.role.startsWith('tool-event:')) {
      const status = m.role.slice('tool-event:'.length) as 'approved' | 'rejected';
      return {role: 'tool-event', content: m.content, status};
    }
    if (m.role === 'assistant' && (m.steps?.length || m.citations?.length)) {
      return {
        role: 'assistant',
        content: m.content,
        steps: m.steps?.length ? m.steps : undefined,
        durationMs: m.durationMs,
        stepsOpen: false,
        citations: m.citations?.length ? m.citations : undefined,
      } as DisplayAiMessage;
    }
    return {role: m.role, content: m.content, attachments: m.attachments} as DisplayAiMessage;
  });
  // Prefer the persisted branch tree (keeps alternate branches); fall back to the
  // flat active path for conversations that were never edited.
  if (!branches.load(conv.tree as any)) branches.loadFlat(flat);
  cancelEdit();
  conversationId.value = conv.id;
  pendingProposal.value = null;
  sentAttachmentsMeta.value = [];
  promotionDismissed.value = false;
  stopIngestPoll();
  scrollToBottom();
  // Resolve token URLs for any persisted attachments so reloaded chips open/preview.
  const urls = await resolveAttachmentUrls(id);
  if (conversationId.value === id) { attachmentUrls.value = urls; refreshPromotion(); }
}

async function removeConversation(id: string) {
  const ok = await deleteConversation(id);
  if (!ok) return;
  if (isMain.value) sharedHistory.conversations.value = sharedHistory.conversations.value.filter(c => c.id !== id);
  else localConversations.value = localConversations.value.filter(c => c.id !== id);
  if (conversationId.value === id) newChat();
}

// Clear the in-memory thread WITHOUT touching the router. The route watcher
// below is the single source of truth and calls this whenever `?c` disappears
// (e.g. the sidebar "New Chat" link, which navigates to /main with empty query).
function resetThread() {
  branches.reset();
  cancelEdit();
  conversationId.value = '';
  pendingProposal.value = null;
  draft.value = '';
  activeSteps.value = [];
  sentAttachmentsMeta.value = [];
  attachmentUrls.value = new Map();
  promotion.value = { total: 0, unpromoted: 0, vaultId: '' };
  promotionDismissed.value = false;
  stopIngestPoll();
}

function newChat() {
  // Main drives everything through the URL so the sidebar link and the in-page
  // buttons share one path (the watcher performs the reset); other modes reset
  // the in-memory thread directly.
  if (isMain.value) {
    if (route.query.c) router.replace({ query: {} });
    else resetThread();
  } else {
    resetThread();
  }
}

// MAIN only: the URL is the single source of truth for which conversation is open
// (sidebar, deep links and the in-page history all set `?c=<id>`). Other modes keep
// selection in-memory, so this watcher is a no-op for them.
watch(() => route.query.c, (id) => {
  if (!isMain.value) return;
  if (typeof id === 'string' && id) loadConversation(id);
  else resetThread();
}, { immediate: false });

onMounted(async () => {
  await refreshHistory();
  if (isMain.value) {
    const initial = route.query.c;
    if (typeof initial === 'string' && initial) loadConversation(initial);
  }
  // A seeded prompt (e.g. a builder deep link) auto-sends once on mount.
  const s = props.seed?.trim();
  if (s) send(s);
});
</script>

<template>
  <div class="relative flex h-full flex-col">
    <!-- Chat toolbar — new chat + history (the global sidebar handles app nav) -->
    <div class="lg:hidden flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <!-- Only the main assistant lives inside the app shell's SidebarProvider;
           other modes (e.g. the blank-layout workflow builder) must NOT mount
           SidebarTrigger, which throws without a provider. -->
      <SidebarTrigger v-if="isMain" class="lg:hidden" />
      <div v-if="hasThread" class="flex items-center gap-2">
        <div class="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkles class="size-3.5"/>
        </div>
        <span class="text-sm font-semibold">PractoAI</span>
      </div>
      <span v-else class="text-sm font-semibold">Assistant</span>
      <div class="ml-auto flex items-center gap-1">
        <!-- Conversation history -->
        <Popover v-if="$viewport.isGreaterThan('tablet')">
          <PopoverTrigger as-child>
            <Button size="icon-sm" variant="ghost" title="Conversation history">
              <History class="size-4"/>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-72 p-0">
            <div class="flex items-center justify-between border-b px-3 py-2">
              <span class="text-sm font-semibold">Recent chats</span>
              <Button size="icon-sm" variant="ghost" title="New chat" @click="newChat">
                <Plus class="size-4"/>
              </Button>
            </div>
            <div v-if="historyLoading" class="flex justify-center py-6">
              <Loader2 class="size-4 animate-spin text-muted-foreground"/>
            </div>
            <div v-else-if="conversations.length" class="max-h-80 overflow-y-auto py-1">
              <div v-for="conv in conversations" :key="conv.id"
                   class="group/conv flex items-center gap-1 px-1.5">
                <button
                    class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                    :class="conversationId === conv.id ? 'bg-accent' : ''"
                    @click="selectConversation(conv.id)">
                  <MessageSquareText class="size-3.5 shrink-0 text-muted-foreground"/>
                  <span class="truncate">{{ conv.title }}</span>
                </button>
                <button
                    class="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/conv:opacity-100"
                    title="Delete conversation" @click="removeConversation(conv.id)">
                  <Trash2 class="size-3.5"/>
                </button>
              </div>
            </div>
            <p v-else class="px-3 py-6 text-center text-xs text-muted-foreground">No conversations yet.</p>
          </PopoverContent>
        </Popover>
        <Sheet v-else>
          <SheetTrigger as-child>
            <Button size="icon-sm" variant="secondary" title="Conversation history">
              <History class="size-4"/>
            </Button>
          </SheetTrigger>
          <SheetContent class="w-72 p-0">
            <SheetHeader class="border-b">
              <span class="text-sm font-semibold">Recent chats</span>
            </SheetHeader>

            <div v-if="historyLoading" class="flex justify-center py-6">
              <Loader2 class="size-4 animate-spin text-muted-foreground"/>
            </div>
            <div v-else-if="conversations.length" class="flex flex-col gap-2 max-h-80 overflow-y-auto py-1">
              <div class="flex flex-row px-2">
                <SheetClose class="w-full">
                  <Button size="sm" variant="outline" class="w-full" title="New chat" @click="newChat">
                    <Plus class="size-4"/>
                    New Chat
                  </Button>
                </SheetClose>
              </div>

              <div class="flex flex-col gap-1">
                <SheetClose v-for="conv in conversations" :key="conv.id" class="w-full">
                  <div
                      class="group/conv flex items-center gap-1 px-1.5">
                    <button
                        class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                        :class="conversationId === conv.id ? 'bg-accent' : ''"
                        @click="selectConversation(conv.id)">
                      <MessageSquareText class="size-3.5 shrink-0 text-muted-foreground"/>
                      <span class="truncate">{{ conv.title }}</span>
                    </button>
                  </div>
                </SheetClose>
              </div>
            </div>
            <p v-else class="px-3 py-6 text-center text-xs text-muted-foreground">No conversations yet.</p>
          </SheetContent>
        </Sheet>
        <Button size="sm" variant="outline" title="New chat" @click="newChat">
          <Plus class="size-4"/>

          New Chat
        </Button>
      </div>
    </div>

    <!-- ░░ Scrollable content ░░ -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Empty (no-thread) state — owned by the host page via the #empty slot, so
           /main shows its home dashboard and the builder shows workflow examples.
           `ask` seeds the composer; `send` fires a prompt straight away. -->
      <div v-if="!hasThread" class="mx-auto w-full max-w-3xl px-4 py-10">
        <slot name="empty" :ask="askAbout" :send="send" />
      </div>

      <!-- Thread -->
      <div v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <template v-for="(msg, i) in messages" :key="i">
          <!-- Tool event -->
          <div v-if="msg.role === 'tool-event'" class="flex justify-center">
                            <span
                                class="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                                <Check v-if="msg.status === 'approved'" class="size-3 text-emerald-500"/>
                                <X v-else class="size-3"/>
                                {{ msg.status === 'approved' ? 'Approved' : 'Dismissed' }}: {{ msg.content }}
                            </span>
          </div>

          <!-- User -->
          <div v-else-if="msg.role === 'user'" class="group flex justify-end">
            <!-- Inline editor (editing this turn forks a new branch on save) -->
            <div v-if="editingIndex === i" class="flex w-full max-w-[80%] flex-col items-end gap-2">
              <textarea v-model="editDraft" rows="3"
                        class="w-full resize-y rounded-2xl border bg-background px-4 py-2.5 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
                        @keydown.escape="cancelEdit"
                        @keydown.enter.exact.prevent="saveEdit(i)"/>
              <div class="flex items-center gap-2">
                <Button size="sm" variant="ghost" class="h-7" @click="cancelEdit">Cancel</Button>
                <Button size="sm" class="h-7" :disabled="!editDraft.trim()" @click="saveEdit(i)">
                  Send
                </Button>
              </div>
            </div>

            <div v-else class="flex max-w-[80%] flex-col items-end gap-1">
              <MessageAttachments v-if="messageChips(msg).length" :attachments="messageChips(msg)" align="end" @preview="openPreview"/>
              <div v-if="stripAttachmentPlaceholders(messageText(msg.content))"
                   class="whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed">
                {{ stripAttachmentPlaceholders(messageText(msg.content)) }}
              </div>
              <!-- Branch switcher + edit affordance -->
              <div class="flex items-center gap-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                   :class="branches.siblings(i).count > 1 ? '!opacity-100' : ''">
                <template v-if="branches.siblings(i).count > 1">
                  <button class="rounded p-0.5 transition-colors hover:text-foreground disabled:opacity-40"
                          :disabled="loading" title="Previous version" @click="switchBranch(i, -1)">
                    <ChevronLeft class="size-3.5"/>
                  </button>
                  <span class="text-xs tabular-nums">{{ branches.siblings(i).current + 1 }}/{{ branches.siblings(i).count }}</span>
                  <button class="rounded p-0.5 transition-colors hover:text-foreground disabled:opacity-40"
                          :disabled="loading" title="Next version" @click="switchBranch(i, 1)">
                    <ChevronRight class="size-3.5"/>
                  </button>
                </template>
                <button class="rounded p-0.5 transition-colors hover:text-foreground disabled:opacity-40"
                        :disabled="loading" title="Edit message"
                        @click="startEdit(i, stripAttachmentPlaceholders(messageText(msg.content)))">
                  <Pencil class="size-3.5"/>
                </button>
              </div>
            </div>
          </div>

          <!-- Assistant -->
          <div v-else class="flex items-start gap-2.5">
            <div class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles class="size-3.5"/>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <!-- Collapsed activity summary -->
              <div v-if="msg.steps && msg.steps.length" class="mb-0.5">
                <button type="button"
                        class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        @click="msg.stepsOpen = !msg.stepsOpen">
                  <Check class="size-3 text-emerald-500"/>
                  <span>Worked for {{ formatDuration(msg.durationMs ?? 0) }}</span>
                  <component :is="msg.stepsOpen ? ChevronDown : ChevronRight" class="size-3"/>
                </button>
                <ul v-if="msg.stepsOpen" class="ml-1 mt-1.5 flex flex-col gap-1 border-l border-border pl-3">
                  <li v-for="step in msg.steps" :key="step.id"
                      class="flex items-center gap-2 text-xs text-muted-foreground">
                    <component :is="stepIcon(step.tool)" class="size-3 shrink-0 opacity-70"/>
                    <span class="truncate">{{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{
                        step.detail
                      }}</span></span>
                  </li>
                </ul>
              </div>
              <!-- A user-stopped turn reads as a neutral note, not an answer/error. -->
              <p v-if="(msg as DisplayAiMessage).stopped" class="text-sm italic text-muted-foreground">
                Response stopped.
              </p>
              <SharedAICitationsCitedAnswer
                  v-else
                  class="text-sm leading-relaxed"
                  :class="(msg as DisplayAiMessage).failed ? 'text-destructive' : ''"
                  :content="messageText(msg.content)"
                  :citations="(msg as DisplayAiMessage).citations"
                  :on-locate="props.onLocate"/>
              <!-- Retry a failed/stopped turn (only the latest — retry drops the active leaf) -->
              <button v-if="((msg as DisplayAiMessage).failed || (msg as DisplayAiMessage).stopped) && i === messages.length - 1 && !loading"
                      type="button"
                      class="mt-0.5 inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      @click="retryTurn">
                <RotateCcw class="size-3"/>
                Retry
              </button>
            </div>
          </div>
        </template>

        <!-- Live working panel -->
        <div v-if="loading" class="flex items-start gap-2.5">
          <div class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Sparkles class="size-3.5"/>
          </div>
          <div class="min-w-[11rem] pt-1">
            <div class="flex items-center gap-1.5 text-xs font-medium">
              <Loader2 class="size-3.5 animate-spin text-muted-foreground"/>
              <span>Working…</span>
            </div>
            <ul v-if="activeSteps.length" class="mt-2 flex flex-col gap-1.5">
              <li v-for="(step, idx) in activeSteps" :key="step.id"
                  class="flex items-center gap-2 text-xs">
                <Loader2 v-if="idx === activeSteps.length - 1"
                         class="size-3 shrink-0 animate-spin text-muted-foreground"/>
                <Check v-else class="size-3 shrink-0 text-emerald-500"/>
                <span class="truncate"
                      :class="idx === activeSteps.length - 1 ? 'text-foreground' : 'text-muted-foreground'">
                                        {{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{
                    step.detail
                  }}</span>
                                    </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Pending proposal -->
        <div v-if="pendingProposal" class="max-w-[85%]">
          <ProposalCard :proposal="pendingProposal" variant="panel" :loading="proposalLoading"
                        @approve="approveProposal" @dismiss="dismissProposal"/>
        </div>

        <div ref="messagesEnd"/>
      </div>
    </div>

    <!-- ░░ Composer (widget-style InputGroup) ░░ -->
    <div class="shrink-0 border-t px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <!-- Host extension point just above the composer (e.g. the Word "including
             selected text" chip). Empty by default. -->
        <slot name="composer-top" />

        <!-- Active context badges -->
        <div v-if="selectedItems.length" class="flex flex-wrap gap-1">
          <Badge v-for="item in selectedItems" :key="item.id" variant="secondary" class="flex items-center gap-1 pr-1">
            <component :is="contextIcons[item.type]" class="size-3 shrink-0"/>
            <span class="max-w-[160px] truncate text-xs">{{ item.label }}</span>
            <button class="ml-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    @click="removeItem(item.id)">
              <X class="size-3"/>
            </button>
          </Badge>
        </div>

        <!-- Vault promotion nudge (suggest mode) — non-blocking, dismissable. -->
        <div v-if="showPromotionNudge"
             class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <Library class="mt-0.5 size-4 shrink-0 text-primary"/>
          <div class="min-w-0 flex-1">
            <p class="text-foreground">
              That's {{ promotion.unpromoted }} files in this chat. Move them to a vault so the assistant
              can keep referencing them without re-uploading.
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <Button size="sm" class="h-7 px-2" :disabled="promoting" @click="promoteAttachments">
              <Library class="size-3.5"/>
              {{ promoting ? 'Moving…' : 'Move to vault' }}
            </Button>
            <button class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Dismiss" @click="promotionDismissed = true">
              <X class="size-3.5"/>
            </button>
          </div>
        </div>

        <!-- Vault ingestion progress (quiet — informs without shouting). -->
        <div v-if="ingest.active" class="px-1 py-0.5">
          <SharedAIIngestRing :done="ingest.done" :total="ingest.total"/>
        </div>

        <!-- Pending attachment chips -->
        <div v-if="attachments.length" class="flex flex-wrap gap-1.5">
          <div v-for="att in attachments" :key="att.id"
               class="flex items-center gap-1.5 rounded-md border bg-background px-1 py-1 text-xs">
            <img v-if="att.mime.startsWith('image/')" :src="att.dataUrl" :alt="att.name"
                 class="size-8 shrink-0 rounded object-cover"/>
            <FileText v-else class="size-4 shrink-0 text-muted-foreground"/>
            <span class="max-w-[140px] truncate font-medium">{{ att.name }}</span>
            <span class="text-muted-foreground">{{ formatBytes(att.size) }}</span>
            <button class="ml-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    :aria-label="`Remove ${att.name}`" @click="removeAttachment(att.id)">
              <X class="size-3"/>
            </button>
          </div>
        </div>

        <input ref="fileInput" type="file" multiple
               accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,text/markdown,text/plain,text/*,.md,.markdown,.txt,.text,.csv,.json,.log"
               class="hidden" @change="onFilesChosen"/>

        <Transition name="rec" mode="out-in">
        <!-- ── Recording / transcribing state ── -->
        <div v-if="dictating" key="rec"
             class="flex flex-col gap-2.5 rounded-xl border border-destructive/30 bg-destructive/[0.03] px-3.5 py-3 shadow-sm">
          <div class="flex items-center gap-3">
            <!-- Live indicator + timer -->
            <div class="flex shrink-0 items-center gap-2">
              <span class="relative flex size-2.5 items-center justify-center">
                <span v-if="isListening" class="absolute inline-flex size-2.5 animate-ping rounded-full bg-destructive/60"/>
                <span class="relative inline-flex size-2.5 rounded-full" :class="isListening ? 'bg-destructive' : 'bg-muted-foreground'"/>
              </span>
              <span class="font-mono text-xs tabular-nums text-muted-foreground">{{ recTime }}</span>
            </div>

            <!-- Waveform (recording) → bouncing dots (processing) -->
            <div class="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
              <div v-if="isListening" class="flex h-8 items-center gap-[3px]" aria-hidden="true">
                <span v-for="i in 56" :key="i" class="w-[3px] shrink-0 rounded-full bg-primary/80"
                      :style="{ height: dictBarHeight(i) + 'px' }"/>
              </div>
              <div v-else class="flex items-center gap-2 text-sm text-muted-foreground">
                <span class="flex gap-1">
                  <span class="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"/>
                  <span class="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"/>
                  <span class="size-1.5 animate-bounce rounded-full bg-primary"/>
                </span>
                Transcribing…
              </div>
            </div>

            <!-- Controls -->
            <div class="flex shrink-0 items-center gap-1.5">
              <Button size="icon-sm" variant="ghost" class="rounded-full text-muted-foreground hover:text-foreground"
                      title="Discard" @click="cancelDictation">
                <X class="size-4"/>
                <span class="sr-only">Discard recording</span>
              </Button>
              <Button size="icon-sm" class="rounded-full" :disabled="!isListening" title="Done" @click="stopDictation">
                <Check class="size-4"/>
                <span class="sr-only">Finish dictation</span>
              </Button>
            </div>
          </div>

          <!-- Live transcript -->
          <p v-if="transcript" class="line-clamp-3 px-0.5 text-sm leading-relaxed text-foreground/90">{{ transcript }}</p>
          <p v-else class="px-0.5 text-sm text-muted-foreground">{{ isListening ? 'Listening — start speaking' : 'Finishing up…' }}</p>
        </div>

        <InputGroup v-else key="composer">
          <InputGroupAddon align="block-start">
            <Button size="sm" variant="outline"
                    :class="selectedItems.length ? 'border-primary/50 text-primary' : ''"
                    @click="contextDrawerOpen = true">
              <AtSign class="size-4"/>
              Add Context
              <Badge v-if="selectedItems.length" variant="secondary" class="ml-1 px-1 text-xs">
                {{ selectedItems.length }}
              </Badge>
            </Button>
          </InputGroupAddon>

          <InputGroupTextarea v-model="draft" placeholder="Ask, Search or Chat…" @keydown="handleKeydown"/>

          <InputGroupAddon align="block-end">
            <InputGroupButton variant="outline" size="icon-sm" title="Attach a PDF or image"
                              @click="openFilePicker">
              <Paperclip class="size-4"/>
              <span class="sr-only">Attach a PDF or image</span>
            </InputGroupButton>
            <InputGroupButton variant="outline" size="sm" :disabled="!canEnhance"
                              title="Enhance prompt — rewrite it for better results" @click="enhancePrompt">
              <Loader2 v-if="enhancing" class="size-4 animate-spin"/>
              <Sparkles v-else class="size-4"/>
              {{ enhancing ? 'Enhancing…' : 'Enhance' }}
            </InputGroupButton>
            <Separator orientation="vertical" class="ml-auto !h-4"/>
            <InputGroupButton size="sm" variant="outline"
                              :title="`Model speed: ${tierLabel}. Click to switch — Auto picks for you, Fast is cheapest, Deep is most capable.`"
                              @click="cycleTier">
              <component :is="tierIcon" class="size-4"/>
              {{ tierLabel }}
            </InputGroupButton>
            <InputGroupButton v-if="sttSupported" size="icon-sm" variant="outline"
                              title="Dictate your prompt" @click="toggleDictation">
              <Mic class="size-4"/>
              <span class="sr-only">Dictate your prompt</span>
            </InputGroupButton>
            <InputGroupButton v-if="loading" variant="default" class="rounded-full" size="icon-sm"
                              title="Stop generating" @click="stopTurn">
              <Square class="size-3.5 fill-current"/>
              <span class="sr-only">Stop generating</span>
            </InputGroupButton>
            <InputGroupButton v-else variant="default" class="rounded-full" size="icon-sm"
                              :disabled="!canSend" @click="send()">
              <ArrowUpIcon class="size-4"/>
              <span class="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        </Transition>
      </div>
    </div>

    <!-- ░░ Context picker — inline overlay (no nested modal) ░░ -->
    <Transition name="context-panel">
      <div v-if="contextDrawerOpen" class="absolute inset-0 z-30 flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40" @click="contextDrawerOpen = false"/>
        <div class="relative flex max-h-[75vh] min-h-0 flex-col rounded-t-xl border-t bg-background shadow-xl">
          <div class="flex shrink-0 items-center gap-2 border-b px-4 py-3">
            <AtSign class="size-4 text-muted-foreground"/>
            <span class="text-sm font-semibold">Add Context</span>
            <Button size="icon-sm" variant="ghost" class="ml-auto" @click="contextDrawerOpen = false">
              <X class="size-4"/>
            </Button>
          </div>
          <div class="shrink-0 border-b px-4 pb-2 pt-3">
            <input v-model="contextSearch" placeholder="Search matters, deadlines, lawyers…"
                   class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"/>
          </div>
          <Tabs v-model="contextTab" class="flex min-h-0 flex-1 flex-col">
            <TabsList class="h-auto shrink-0 justify-start gap-1 rounded-none border-b bg-transparent px-4 py-2">
              <TabsTrigger value="matter" class="gap-1.5 text-xs">
                <Building2 class="size-3"/>
                Matters
              </TabsTrigger>
              <TabsTrigger value="deadline" class="gap-1.5 text-xs">
                <Clock class="size-3"/>
                Deadlines
              </TabsTrigger>
              <TabsTrigger value="user" class="gap-1.5 text-xs">
                <User class="size-3"/>
                Lawyers
              </TabsTrigger>
            </TabsList>
            <div v-if="contextLoading" class="flex items-center justify-center p-8">
              <Loader2 class="size-5 animate-spin text-muted-foreground"/>
            </div>
            <template v-else>
              <TabsContent value="matter" class="mt-0 flex-1 overflow-y-auto pb-8">
                <button v-for="m in filteredMatters" :key="m.id"
                        class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                        :class="isSelected(m.id) ? 'bg-accent' : ''"
                        @click="toggleItem({ type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber })">
                  <div class="flex min-w-0 flex-1 flex-col"><span class="truncate text-sm font-medium">{{
                      m.name
                    }}</span><span class="text-xs text-muted-foreground">{{ m.caseNumber }}</span></div>
                  <Check v-if="isSelected(m.id)" class="size-4 shrink-0 text-primary"/>
                </button>
                <p v-if="!filteredMatters.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No matters
                  found.</p>
              </TabsContent>
              <TabsContent value="deadline" class="mt-0 flex-1 overflow-y-auto pb-8">
                <button v-for="d in filteredDeadlines" :key="d.id"
                        class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                        :class="isSelected(d.id) ? 'bg-accent' : ''"
                        @click="toggleItem({ type: 'deadline', id: d.id, label: d.name, sublabel: d.matterName })">
                  <div class="flex min-w-0 flex-1 flex-col"><span class="truncate text-sm font-medium">{{
                      d.name
                    }}</span><span class="truncate text-xs text-muted-foreground">{{ d.matterName }}</span></div>
                  <Check v-if="isSelected(d.id)" class="size-4 shrink-0 text-primary"/>
                </button>
                <p v-if="!filteredDeadlines.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No
                  pending deadlines found.</p>
              </TabsContent>
              <TabsContent value="user" class="mt-0 flex-1 overflow-y-auto pb-8">
                <button v-for="u in filteredUsers" :key="u.id"
                        class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                        :class="isSelected(u.id) ? 'bg-accent' : ''"
                        @click="toggleItem({ type: 'user', id: u.id, label: u.name, sublabel: u.role })">
                  <Avatar class="size-7 shrink-0">
                    <AvatarImage :src="u.avatar ?? ''" :alt="u.name"/>
                    <AvatarFallback class="bg-primary text-[10px] text-primary-foreground">{{
                        initials(u.name)
                      }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="flex min-w-0 flex-1 flex-col"><span class="text-sm font-medium">{{ u.name }}</span><span
                      v-if="u.role" class="text-xs capitalize text-muted-foreground">{{ u.role }}</span></div>
                  <Check v-if="isSelected(u.id)" class="size-4 shrink-0 text-primary"/>
                </button>
                <p v-if="!filteredUsers.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No lawyers
                  found.</p>
              </TabsContent>
            </template>
          </Tabs>
        </div>
      </div>
    </Transition>

    <!-- ░░ Conversational voice mode ░░ -->
    <Transition name="voice">
      <div v-if="voiceOpen" class="absolute inset-0 z-40 flex flex-col bg-background">
        <!-- Top bar -->
        <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="size-2 animate-pulse rounded-full bg-primary"/>
            <span class="text-sm font-medium text-primary">Live voice</span>
          </div>
          <Button size="icon-sm" variant="ghost" title="Back to chat" @click="exitVoice">
            <MessageSquareText class="size-4"/>
          </Button>
        </div>

        <!-- Proposal card (e.g. create-matter) surfaces here too -->
        <Transition name="context-panel">
          <ProposalCard v-if="pendingProposal" :proposal="pendingProposal" variant="panel"
                        :loading="proposalLoading" class="mx-4 mt-3 shrink-0"
                        @approve="approveProposal" @dismiss="dismissProposal"/>
        </Transition>

        <!-- Centre: orb + live text -->
        <div class="flex flex-1 flex-col items-center justify-center gap-7 px-8">
          <button class="relative flex size-36 items-center justify-center" @click="tapOrb">
            <span class="absolute size-36 rounded-full bg-primary/8 transition-transform duration-75 ease-out"
                  :style="{ transform: `scale(${outerRingScale})` }"/>
            <span class="absolute size-36 rounded-full bg-primary/12 transition-transform duration-75 ease-out"
                  :style="{ transform: `scale(${innerRingScale})` }"/>
            <span class="relative z-10 flex size-24 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/25 transition-all duration-300"
                  :class="{ 'scale-105': voiceState === 'listening', 'animate-pulse': voiceState === 'speaking' }">
              <span v-if="voiceState === 'listening'" class="flex h-9 items-end gap-1">
                <span v-for="i in 7" :key="i" class="w-1 rounded-full bg-primary-foreground transition-all duration-75 ease-out"
                      :style="{ height: `${barHeight(i)}px` }"/>
              </span>
              <Loader2 v-else-if="voiceState === 'thinking'" class="size-8 animate-spin opacity-90"/>
              <AudioLines v-else-if="voiceState === 'speaking'" class="size-8 opacity-90"/>
              <Sparkles v-else class="size-8 opacity-90"/>
            </span>
          </button>

          <div class="flex min-h-[4rem] w-full max-w-md flex-col items-center justify-center gap-1 text-center">
            <Transition name="voice-fade" mode="out-in">
              <p v-if="voiceState === 'listening' && transcript" key="t" class="text-lg font-medium leading-snug text-foreground">{{ transcript }}</p>
              <p v-else-if="voiceState === 'listening'" key="l" class="animate-pulse text-sm font-medium text-primary">Listening…</p>
              <p v-else-if="voiceState === 'thinking'" key="th" class="text-sm text-muted-foreground">Thinking…</p>
              <p v-else-if="voiceState === 'speaking' && caption" key="c" class="line-clamp-4 text-sm leading-relaxed text-foreground">{{ caption }}</p>
              <p v-else-if="voiceState === 'speaking'" key="s" class="animate-pulse text-sm font-medium text-primary">Speaking…</p>
              <p v-else key="e" class="text-sm text-muted-foreground">Tap the orb and start talking</p>
            </Transition>
          </div>
        </div>

        <!-- Bottom controls -->
        <div class="flex shrink-0 items-center justify-center gap-3 border-t px-6 pb-6 pt-3">
          <Button size="icon" variant="ghost" class="relative rounded-full" title="Add context"
                  @click="contextDrawerOpen = true">
            <AtSign class="size-5"/>
            <span v-if="selectedItems.length"
                  class="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {{ selectedItems.length }}
            </span>
          </Button>

          <Button size="icon" variant="ghost" class="rounded-full"
                  :class="bargeInEnabled ? 'text-primary' : 'text-muted-foreground'"
                  :title="bargeInEnabled ? 'Talk-over on (use headphones)' : 'Talk-over off — tap to enable (headphones only)'"
                  @click="toggleBargeIn">
            <Headphones class="size-5"/>
          </Button>

          <Button v-if="isSpeaking" size="icon" variant="ghost" class="rounded-full"
                  title="Stop speaking" @click="beginListening()">
            <VolumeX class="size-5"/>
          </Button>

          <Button size="icon" class="size-16 rounded-full shadow-lg shadow-primary/20 [&_svg]:size-6"
                  :variant="isListening ? 'destructive' : 'default'"
                  :class="isListening ? 'ring-4 ring-destructive/20' : ''"
                  :disabled="voiceState === 'thinking'" @click="tapOrb">
            <MicOff v-if="isListening"/>
            <Mic v-else/>
          </Button>

          <Button size="icon" variant="destructive" class="rounded-full" title="Exit voice" @click="exitVoice">
            <X class="size-5"/>
          </Button>
        </div>
      </div>
    </Transition>

    <!-- ── Attachment preview (right sheet on desktop, bottom on touch) ──────── -->
    <Sheet v-model:open="previewOpen">
      <SheetContent
          :side="isDesktop ? 'right' : 'bottom'"
          hide-x
          class="flex flex-col gap-0 p-0"
          :class="isDesktop ? 'w-full sm:max-w-xl' : 'h-[88dvh]'"
      >
        <SheetTitle class="sr-only">Attachment preview</SheetTitle>
        <DocumentPreview v-if="previewDoc" :doc="previewDoc"
                         :resolve-url="resolvePreviewUrl"
                         class="min-h-0 flex-1" @close="previewOpen = false"/>
      </SheetContent>
    </Sheet>
  </div>
</template>

<style scoped>
/* Context picker slide-up */
.context-panel-enter-active,
.context-panel-leave-active {
  transition: opacity 0.2s ease;
}

.context-panel-enter-active > div:last-child,
.context-panel-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.context-panel-enter-from,
.context-panel-leave-to {
  opacity: 0;
}

.context-panel-enter-from > div:last-child,
.context-panel-leave-to > div:last-child {
  transform: translateY(100%);
}

/* Composer ⇄ recording-panel swap */
.rec-enter-active,
.rec-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.rec-enter-from,
.rec-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Voice overlay fade */
.voice-enter-active {
  transition: opacity 0.25s ease;
}

.voice-leave-active {
  transition: opacity 0.18s ease;
}

.voice-enter-from,
.voice-leave-to {
  opacity: 0;
}

/* Live-text crossfade inside the voice overlay */
.voice-fade-enter-active,
.voice-fade-leave-active {
  transition: opacity 0.15s ease;
}

.voice-fade-enter-from,
.voice-fade-leave-to {
  opacity: 0;
}
</style>
