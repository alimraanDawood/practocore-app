<script lang="ts" setup>
import {
  AtSign, ArrowUpIcon, Paperclip, Globe,
  Mic, MicOff, VolumeX, Volume2, X, Check, Loader2, Sparkles,
  Building2, Clock, User,
  History, Plus, Trash2, MessageSquare, Settings, Lock, Zap, SquarePen,
  FileText, Briefcase, ArrowRight, Bell,
  Search, BookOpen, ChevronRight, ChevronDown, ChevronLeft, Pencil, Square, RotateCcw, Download, FileType2, Library,
  Gauge,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useMediaQuery } from '@vueuse/core';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '~/components/ui/sheet';
import DocumentPreview, { type PreviewDoc } from '~/components/shared/Vault/DocumentPreview.vue';
import ProposalCard from './ProposalCard.vue';
import MessageAttachments from './MessageAttachments.vue';
import { initials } from './proposals/theme';
import type { VoiceEntry } from '~/composables/useSpeech';
import { getSignedInUser } from '~/services/auth';
import {
  sendAiMessageStream, confirmAiProposal, improvePrompt, attachmentSha256, resolveAttachmentUrls, base64ToObjectUrl,
  listConversationAttachments, promoteConversationAttachments, vaultIngestProgress,
  listConversations, getConversation, deleteConversation, saveConversationTree,
  type AiMessage, type AiContentBlock,
  type AiImageMediaType, type AiResponse, type AiContext, type AiConversationSummary,
  type AiAttachmentMeta, type ConvDisplayMessage, type ConvAttachment, type AiStreamStep, type AiCitation,
} from '~/services/ai';
import type { AttachmentView } from './MessageAttachments.vue';
import { getMatters, getAllDeadlines } from '~/services/matters';
import { getOrganisationUsers } from '~/services/admin';
import { useMattersStore } from '~/stores/matters';
import AICreditGauge from './AICreditGauge.vue';

const props = defineProps<{ currentMatterId?: string }>();
const open = defineModel<boolean>('open', { default: false });

const isDesktop = useMediaQuery('(min-width: 1024px)');

// ── Speech ────────────────────────────────────────────────────────────────────
const {
  isListening, isTranscribing, transcript, audioLevel, micError,
  startListening, stopListening,
  isSpeaking, ttsSupported, caption, speak, speakTimed, stopSpeaking, unlockAudio,
  prefs: speechPrefs, savePrefs,
} = useSpeech();

// ── Mode ──────────────────────────────────────────────────────────────────────
const audioMode = ref(false);

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
const voiceState = ref<VoiceState>('idle');

// Close audio mode when the sheet closes
watch(open, (isOpen) => {
  if (!isOpen && audioMode.value) exitAudioMode();
  // Re-arm the credit gate on each open: if the user topped up (e.g. via Billing)
  // the next send re-validates server-side instead of staying locked from a stale 402.
  if (isOpen) {
    creditBlocked.value = false;
    refreshAiUsage();
  }
});

// ── Conversational loop ───────────────────────────────────────────────────────
// End-of-turn is detected server-side by AssemblyAI (it finalises the transcript
// and stops the stream). We no longer run a client-side silence timer — it
// competed with the model's turn detection and cut speakers off during pauses.

watch(isListening, (listening) => {
  if (listening) {
    voiceState.value = 'listening';
  } else if (voiceState.value === 'listening') {
    voiceState.value = 'thinking';
  }
});

// Single-word noise tokens that should never be sent as a message on their own
const NOISE_TOKENS = new Set([
  'uh', 'um', 'ah', 'oh', 'hmm', 'hm', 'mhm', 'mm', 'er', 'eh',
  'okay', 'ok', 'yeah', 'yep', 'nope', 'hi', 'hey',
]);

function isUsableTranscript(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1 && NOISE_TOKENS.has(words[0]!)) return false;
  return true;
}

watch(isTranscribing, (transcribing) => {
  if (!transcribing) {
    const t = transcript.value.trim();
    if (t && isUsableTranscript(t)) send(t);
    else voiceState.value = 'idle';
  }
});

// When AI finishes speaking in audio mode, auto-restart listening
watch(isSpeaking, (speaking) => {
  if (speaking) {
    voiceState.value = 'speaking';
  } else if (voiceState.value === 'speaking') {
    voiceState.value = 'idle';
    if (audioMode.value) {
      setTimeout(() => {
        if (audioMode.value && !isListening.value && voiceState.value === 'idle') {
          voiceState.value = 'listening';
          startListening();
        }
      }, 450);
    }
  }
});

watch(micError, () => {
  voiceState.value = 'idle';
});

function toggleMic() {
  if (!isSubscriptionActive.value) return;
  if (!audioMode.value) {
    // Unlock audio synchronously on the user gesture before any async work
    unlockAudio();
    audioMode.value = true;
    if (!isListening.value) {
      stopSpeaking();
      startListening();
    }
    return;
  }
  if (isListening.value) {
    stopListening();
  } else {
    stopSpeaking();
    startListening();
  }
}

function exitAudioMode() {
  stopListening();
  stopSpeaking();
  voiceState.value = 'idle';
  audioMode.value = false;
}

// ── Voice settings ────────────────────────────────────────────────────────────
const voiceSettingsOpen = ref(false);
const voices = ref<VoiceEntry[]>([]);
const voicesLoading = ref(false);
const testText = ref('The deadline for filing submissions is March 15th. Please review the matter urgently.');
const testPlaying = ref(false);

watch(voiceSettingsOpen, async (isOpen) => {
  if (!isOpen || voices.value.length > 0) return;
  voicesLoading.value = true;
  try {
    const { pb, SERVER_URL } = await import('~/lib/pocketbase');
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/voices`, {
      headers: { 'Authorization': pb.authStore.token },
    });
    if (res.ok) voices.value = (await res.json()).voices ?? [];
  } catch {}
  voicesLoading.value = false;
});

async function testVoice(voiceId: string) {
  testPlaying.value = true;
  const prev = speechPrefs.value.voiceId;
  speechPrefs.value.voiceId = voiceId;
  await speak(testText.value);
  speechPrefs.value.voiceId = prev;
  testPlaying.value = false;
}

function selectVoice(voice: VoiceEntry) {
  speechPrefs.value.voiceId = voice.voice_id;
  speechPrefs.value.voiceName = voice.name;
  savePrefs();
}

// Orb visual helpers
function barHeight(i: number): number {
  if (!isListening.value) return 4;
  const base = 4;
  const wave = Math.abs(Math.sin((i + 1) * 0.9 + Date.now() / 200));
  return Math.max(base, (audioLevel.value / 100) * 40 * wave + base);
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

// ── Chat ──────────────────────────────────────────────────────────────────────
type ToolEvent = { role: 'tool-event'; content: string; status: 'approved' | 'rejected' };
// UI-only message: a tappable card to open a just-created matter. Kept out of the
// API/history payloads (it isn't an assistant/user turn) — see apiMessages/convMessages.
type MatterCreated = { role: 'matter-created'; matterId: string; matterName?: string };
type ReminderCreated = { role: 'reminder-created'; reminderTitle?: string };
// UI-only card: a freshly generated .docx the user can download. Carries the
// GeneratedDocuments row id so the card can fetch a file token on demand.
type DocumentGenerated = {
  role: 'document-generated';
  documentId: string;
  title?: string;
  kind?: string;
  filename?: string;
};
// Assistant turns optionally carry the activity steps that produced them (streamed
// mid-turn) plus how long the work took, so the UI can show a collapsible
// "Worked for Ns" summary. These UI-only fields are stripped before the API payload.
type DisplayAiMessage = AiMessage & { steps?: AiStreamStep[]; durationMs?: number; stepsOpen?: boolean; citations?: AiCitation[]; attachments?: ConvAttachment[]; failed?: boolean; stopped?: boolean; tier?: 'auto' | 'fast' | 'deep' };
type ChatMessage = DisplayAiMessage | ToolEvent | MatterCreated | ReminderCreated | DocumentGenerated;

// Conversation branching: the message tree owns every turn; `messages` is the
// active branch projected as a flat list. Editing an earlier user turn forks a
// sibling branch the user can switch between with the version arrows.
const branches = useChatBranches<ChatMessage>();
const messages = branches.messages;

// UI-only affordance roles never go to the model or the saved transcript.
const UI_ONLY_ROLES = ['matter-created', 'reminder-created', 'document-generated'];

const apiMessages = computed<AiMessage[]>(() =>
  messages.value
    // Drop tool-events, UI-only cards, and the failed/stopped placeholders — the
    // last are session-only notes, never part of the model's context.
    .filter((m): m is DisplayAiMessage => m.role !== 'tool-event' && !UI_ONLY_ROLES.includes(m.role)
      && !(m as DisplayAiMessage).failed && !(m as DisplayAiMessage).stopped)
    // Project to the bare {role, content} the API expects — drop UI-only step metadata.
    .map(m => ({ role: m.role, content: m.content })),
);

const convMessages = computed<ConvDisplayMessage[]>(() =>
  messages.value
    // UI-only affordance cards + failed/stopped placeholders aren't part of the transcript.
    .filter((m): m is AiMessage | ToolEvent => !UI_ONLY_ROLES.includes(m.role)
      && !(m as DisplayAiMessage).failed && !(m as DisplayAiMessage).stopped)
    .map(m =>
      m.role === 'tool-event'
        ? { role: `tool-event:${m.status}`, content: m.content }
        // Persisted history is text-only: flatten any multimodal content to a
        // string with bracketed placeholders for attachments. Attachment refs ride
        // alongside so the chips survive a reload (resolved via AiChatAttachments).
        : { role: m.role, content: messageText(m.content), attachments: (m as DisplayAiMessage).attachments },
    ),
);
const conversationId = ref<string>('');
const pendingProposal = ref<AiResponse | null>(null);
const inputText = ref('');
const loading = ref(false);
const messagesEnd = ref<HTMLElement | null>(null);

// Stop button: controller for the in-flight streaming turn. Aborting makes the
// request resolve to { aborted:true }, which we drop silently.
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
function switchBranch(index: number, dir: -1 | 1) {
  if (loading.value) return;
  cancelEdit();
  branches.switchSibling(index, dir);
  persistTree();
  scrollToBottom();
}

// Persist the branch tree (best-effort) so alternate branches survive a reload.
let treeSaveTimer: ReturnType<typeof setTimeout> | null = null;
function persistTree() {
  if (!conversationId.value) return;
  if (treeSaveTimer) clearTimeout(treeSaveTimer);
  const id = conversationId.value;
  treeSaveTimer = setTimeout(() => { void saveConversationTree(id, branches.serialize()); }, 400);
}

// ── Live activity steps ───────────────────────────────────────────────────────
// Populated by the streaming chat endpoint as the tool loop runs. The last entry is
// the in-flight step (spinner); earlier ones are done (check). Cleared when the reply
// lands — at which point the real tool steps are attached to the assistant message.
const activeSteps = ref<AiStreamStep[]>([]);
const workStartedAt = ref(0);

/** Map a tool name to a small status icon for the activity list. */
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
      return Sparkles; // synthetic "Assessing"/"Drafting" bookends
    default:
      return Briefcase; // matter/deadline/template reads
  }
}

/** Human "Worked for 6s" / "Worked for 1m 12s" from a millisecond duration. */
function formatDuration(ms: number): string {
  const secs = Math.max(1, Math.round(ms / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

// ── Attachments (PDF + images) ────────────────────────────────────────────────
// Attached files ride along on the next send as image/document content blocks.
// Sonnet 4.6 reads PDFs and images natively; the backend caps the total base64
// payload at 30MB and rejects anything past that.
interface Attachment {
  id: string;
  name: string;
  /** MIME type — image/*, application/pdf, or a text/Markdown type. */
  mime: string;
  /** Raw byte size, for display + cap enforcement. */
  size: number;
  /** 'binary' = image/PDF (base64); 'text' = Markdown/plain-text (raw UTF-8). */
  kind: 'binary' | 'text';
  /** Base64 data with NO `data:` URI prefix (binary kind only). */
  base64?: string;
  /** Full data URL retained for image thumbnails (binary kind only). */
  dataUrl?: string;
  /** Raw UTF-8 text (text kind only), sent as an Anthropic text document block. */
  text?: string;
}

const attachments = ref<Attachment[]>([]);
// Metadata for files sent this session, accumulated and re-sent each call so the
// backend can name + dedup the persisted AiChatAttachments (and a proposal turn
// still names its files on confirm). Reset on new chat / conversation switch.
const sentAttachmentsMeta = ref<AiAttachmentMeta[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

/** Per-file cap (10MB) — generous enough for multi-page PDFs and high-res photos. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Total cap across all attachments in one send (25MB raw ≈ 33MB base64). */
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const totalAttachmentBytes = computed(() =>
  attachments.value.reduce((sum, a) => sum + a.size, 0),
);

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
      // FileReader returns `data:<mime>;base64,<payload>` — strip the prefix so we
      // can feed the raw payload to Anthropic's `source.data`.
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      resolve({ base64, dataUrl });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const ACCEPTED_IMAGE_TYPES: AiImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Text/Markdown/source files. Browsers report an unreliable (often empty) MIME
// for .md, so we also match on extension. Sent as Anthropic text document blocks.
const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.text', '.csv', '.json', '.log', '.rtf'];
function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (TEXT_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
  const t = file.type;
  return t.startsWith('text/') || t === 'application/json' || t === 'application/markdown';
}

function isAcceptedFile(file: File): boolean {
  return file.type === 'application/pdf'
    || (ACCEPTED_IMAGE_TYPES as string[]).includes(file.type)
    || isTextFile(file);
}

async function addFiles(files: File[] | FileList) {
  const list = Array.from(files);
  for (const file of list) {
    if (!isAcceptedFile(file)) {
      toast('Unsupported file', { description: `${file.name} (${file.type || 'unknown type'}) — PDFs, images, and text/Markdown only.` });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast('File too large', { description: `${file.name} is ${formatBytes(file.size)}. Each file must be under ${formatBytes(MAX_FILE_BYTES)}.` });
      continue;
    }
    if (totalAttachmentBytes.value + file.size > MAX_TOTAL_BYTES) {
      toast('Attachment limit reached', { description: `Total attachment size must stay under ${formatBytes(MAX_TOTAL_BYTES)}.` });
      continue;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      if (isTextFile(file)) {
        const text = await file.text();
        attachments.value.push({ id, name: file.name, mime: file.type || 'text/markdown', size: file.size, kind: 'text', text });
      } else {
        const { base64, dataUrl } = await fileToBase64(file);
        attachments.value.push({ id, name: file.name, mime: file.type, size: file.size, kind: 'binary', base64, dataUrl });
      }
    } catch (err: any) {
      toast('Could not read file', { description: file.name + (err?.message ? ` — ${err.message}` : '') });
    }
  }
}

async function onFilesChosen(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  await addFiles(input.files);
  // Reset so the same file can be re-selected after removal.
  input.value = '';
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id);
}

function openFilePicker() {
  if (!aiEnabled.value) return;
  fileInput.value?.click();
}

const firstName = computed(() => getSignedInUser()?.name?.split(' ').at(0) || 'there');

// PractoAI calls cost money, so chatting requires a live plan. Gates the input
// (text + voice + send) and surfaces a quiet banner when the plan has lapsed.
const activePlan = usePlanActive();
const isSubscriptionActive = computed(() => activePlan.value?.active === true);

// AI credit gate (AI_CREDITS_STRATEGY.md §3). `creditBlocked` locks the composer
// after a 402 (pool + overage + grace exhausted); `creditDegraded` is advisory —
// AI still answers on the lighter model, so we only surface a banner.
const creditBlocked = ref(false);
const creditDegraded = ref(false);

// Both a live plan and available credits are required to chat.
const aiEnabled = computed(() => isSubscriptionActive.value && !creditBlocked.value);

// Shared usage state powering the header gauge — refreshed after each round so
// the credits tick up live as they're spent.
const { usage: aiUsage, refresh: refreshAiUsage } = useAiUsage();

// Keep the gate in sync with the shared usage state: when a top-up elsewhere
// (e.g. Billing) refreshes usage to a non-blocked state, clear the local lock so
// the composer reopens without waiting for a reopen or another 402 round-trip.
watch(aiUsage, (u) => {
  if (!u) return;
  creditBlocked.value = u.state === 'blocked';
  creditDegraded.value = u.state === 'degraded';
});

// Speed/cost tier the user picks for chat. 'auto' lets the backend choose; 'fast'
// forces the cheapest model (much lower credit burn — DeepSeek where configured);
// 'deep' forces the premium model. Persisted so the choice sticks across sessions.
const TIERS = ['auto', 'fast', 'deep'] as const;
type ChatTier = typeof TIERS[number];
const chatTier = ref<ChatTier>('auto');
if (import.meta.client) {
  const saved = localStorage.getItem('ai.chat.tier');
  if (saved === 'auto' || saved === 'fast' || saved === 'deep') chatTier.value = saved;
}
watch(chatTier, (t) => { if (import.meta.client) localStorage.setItem('ai.chat.tier', t); });
function cycleTier() {
  chatTier.value = TIERS[(TIERS.indexOf(chatTier.value) + 1) % TIERS.length];
}
const tierLabel = computed(() => chatTier.value === 'fast' ? 'Fast' : chatTier.value === 'deep' ? 'Deep' : 'Auto');
const tierIcon = computed(() => chatTier.value === 'fast' ? Zap : chatTier.value === 'deep' ? Sparkles : Gauge);
const tierTitle = computed(() =>
  `Model speed: ${tierLabel.value}. Click to switch — Auto picks for you, Fast is cheapest (lowest credit cost), Deep is most capable.`,
);

// Per-message badge explaining which tier actually served a reply, so the cost is
// legible. Only shown for the non-default tiers (fast/deep).
function msgTierLabel(m: ChatMessage): string {
  const t = (m as DisplayAiMessage).tier;
  if (t === 'fast') return 'Fast model · lower credit cost';
  if (t === 'deep') return 'Deep model · higher credit cost';
  return '';
}
function msgTierIcon(m: ChatMessage) {
  return (m as DisplayAiMessage).tier === 'deep' ? Sparkles : Zap;
}

const composerPlaceholder = computed(() => {
  if (!isSubscriptionActive.value) return 'Subscription required to chat';
  if (creditBlocked.value) return 'AI credit limit reached';
  return 'Ask, Search or Chat...';
});

const canSend = computed(() =>
  (inputText.value.trim().length > 0 || attachments.value.length > 0)
  && !loading.value
  && aiEnabled.value,
);

/** Flatten a message's content (string or content-block array) to a displayable
 *  string. Image/document blocks render as bracketed placeholders so the empty
 *  state, history preview, and persisted conversation rows have something
 *  meaningful to show. */
function messageText(content: AiMessage['content']): string {
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text);
    else if (block.type === 'image') parts.push('[image]');
    else if (block.type === 'document') parts.push(block.source?.type === 'text' ? '[document]' : '[PDF]');
  }
  return parts.join(' ');
}

// sha256 → resolved open/download URL for attachments in the open conversation. Blob
// (or data:) URLs for files sent this session; token URLs resolved on reload.
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
// Nudge the user to move a conversation's overflow files into its per-conversation
// vault so the assistant can keep referencing them without re-uploading.
const ATTACH_NUDGE_THRESHOLD = 5;
const promotion = ref<{ total: number; unpromoted: number; vaultId: string }>({ total: 0, unpromoted: 0, vaultId: '' });
const promotionDismissed = ref(false);
const promoting = ref(false);
const showPromotionNudge = computed(() =>
  !promotionDismissed.value && !promoting.value && promotion.value.unpromoted >= ATTACH_NUDGE_THRESHOLD);

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

const lastAssistantText = computed(() => {
  const msgs = messages.value.filter((m): m is AiMessage => m.role === 'assistant');
  return messageText(msgs.at(-1)?.content ?? '');
});

const lastUserText = computed(() => {
  const msgs = messages.value.filter((m): m is AiMessage => m.role === 'user');
  return messageText(msgs.at(-1)?.content ?? '');
});

// ── History panel ─────────────────────────────────────────────────────────────
const historyOpen = ref(false);
const historyLoading = ref(false);
const conversations = ref<AiConversationSummary[]>([]);
const historyLoaded = ref(false);

watch(historyOpen, async (open) => {
  if (!open || historyLoaded.value) return;
  await refreshHistory();
});

async function refreshHistory() {
  historyLoading.value = true;
  try {
    const page = await listConversations(1, 30);
    conversations.value = page?.items ?? [];
    historyLoaded.value = true;
  } finally {
    historyLoading.value = false;
  }
}

async function loadConversation(id: string) {
  if (conversationId.value === id) { historyOpen.value = false; return; }
  const conv = await getConversation(id);
  if (!conv) return;
  const flat = (conv.messages ?? []).map((m): ChatMessage => {
    if (m.role.startsWith('tool-event:')) {
      const status = m.role.slice('tool-event:'.length) as 'approved' | 'rejected';
      return { role: 'tool-event', content: m.content, status };
    }
    // Rehydrate the collapsed "Worked for Ns" activity summary and the citation
    // trail persisted with the turn, so both survive a conversation reload.
    if (m.role === 'assistant' && ((m.steps && m.steps.length) || (m.citations && m.citations.length))) {
      return {
        role: 'assistant',
        content: m.content,
        steps: m.steps?.length ? m.steps : undefined,
        durationMs: m.durationMs,
        stepsOpen: false,
        citations: m.citations?.length ? m.citations : undefined,
      } as DisplayAiMessage;
    }
    return { role: m.role, content: m.content, attachments: m.attachments } as DisplayAiMessage;
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
  historyOpen.value = false;
  scrollToBottom();
  // Resolve token URLs for any persisted attachments so reloaded chips open/preview.
  const urls = await resolveAttachmentUrls(id);
  if (conversationId.value === id) { attachmentUrls.value = urls; refreshPromotion(); }
}

function newChat() {
  branches.reset();
  cancelEdit();
  conversationId.value = '';
  pendingProposal.value = null;
  sentAttachmentsMeta.value = [];
  attachmentUrls.value = new Map();
  promotion.value = { total: 0, unpromoted: 0, vaultId: '' };
  promotionDismissed.value = false;
  stopIngestPoll();
  inputText.value = '';
  // Clear the credit gate so a fresh chat can try again; the next send
  // re-blocks via the 402 path if the pool is still exhausted.
  creditBlocked.value = false;
  creditDegraded.value = false;
  historyOpen.value = false;
}

async function removeConversation(id: string) {
  const ok = await deleteConversation(id);
  if (!ok) return;
  conversations.value = conversations.value.filter(c => c.id !== id);
  if (conversationId.value === id) newChat();
}

function relativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return '';
  }
}

// ── Context (multi-select) ────────────────────────────────────────────────────
type ContextType = 'matter' | 'deadline' | 'user';
interface ContextItem { type: ContextType; id: string; label: string; sublabel?: string }

const selectedItems = ref<ContextItem[]>([]);

watch(
  () => props.currentMatterId,
  async (id) => {
    if (!id) return;
    const alreadyIn = selectedItems.value.some(i => i.type === 'matter' && i.id === id);
    if (alreadyIn) return;
    selectedItems.value.push({ type: 'matter', id, label: 'Loading…' });

    // Resolve the matter name straight away rather than waiting for the
    // context drawer to open and populate mattersList.
    try {
      const { pb } = await import('~/lib/pocketbase');
      const matter = await pb.collection('Matters').getOne(id, { fields: 'id,name,caseNumber' });
      const idx = selectedItems.value.findIndex(i => i.type === 'matter' && i.id === id);
      if (idx >= 0) {
        selectedItems.value[idx] = {
          ...selectedItems.value[idx]!,
          label: matter.name || 'Matter',
          sublabel: matter.caseNumber,
        };
      }
    } catch {
      // Leave the placeholder; the drawer will resolve it if reopened.
    }
  },
  { immediate: true },
);

const contextIcons: Record<ContextType, any> = { matter: Building2, deadline: Clock, user: User };

function buildContext(): AiContext | undefined {
  if (selectedItems.value.length === 0) return undefined;
  return {
    matterIds:   selectedItems.value.filter(i => i.type === 'matter').map(i => i.id),
    deadlineIds: selectedItems.value.filter(i => i.type === 'deadline').map(i => i.id),
    userIds:     selectedItems.value.filter(i => i.type === 'user').map(i => i.id),
  };
}

// ── Prompt enhancement ─────────────────────────────────────────────────────────
// "Enhance" rewrites the user's draft into a sharper prompt that steers the
// assistant toward the right tools. The toast offers a one-click Undo back to the
// original text.
const enhancing = ref(false);

const canEnhance = computed(() =>
  inputText.value.trim().length > 0 && !enhancing.value && !loading.value && aiEnabled.value,
);

async function enhancePrompt() {
  const original = inputText.value.trim();
  if (!original || enhancing.value || loading.value || !aiEnabled.value) return;

  enhancing.value = true;
  try {
    const result = await improvePrompt(original, buildContext());
    if (result.blocked) {
      creditBlocked.value = true;
      toast.error(result.error ?? 'AI credit limit reached.');
      return;
    }
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.improved.trim() === original) {
      toast('Prompt already looks clear — left it as is.');
      return;
    }
    inputText.value = result.improved;
    toast('Prompt enhanced', {
      action: { label: 'Undo', onClick: () => { inputText.value = original; } },
    });
  } finally {
    enhancing.value = false;
  }
}

function isSelected(id: string) {
  return selectedItems.value.some(i => i.id === id);
}

function toggleItem(item: ContextItem) {
  const idx = selectedItems.value.findIndex(i => i.id === item.id);
  if (idx >= 0) {
    selectedItems.value.splice(idx, 1);
  } else {
    selectedItems.value.push(item);
  }
}

function removeItem(id: string) {
  selectedItems.value = selectedItems.value.filter(i => i.id !== id);
}

// ── Context drawer ────────────────────────────────────────────────────────────
const contextDrawerOpen = ref(false);
const contextTab = ref<ContextType>('matter');
const contextSearch = ref('');

// ── Android back button ─────────────────────────────────────────────────────
// Audio mode and the context drawer are inline panels (not modal components),
// so register them with the overlay stack to make the hardware back button
// close them before closing the chat itself. The chat Dialog/Sheet registers
// automatically via its wrapper, so these sit on top of it in the stack.
const { register: registerOverlay, unregister: unregisterOverlay } = useOverlayStack();
let audioModeOverlayId: number | null = null;
let contextDrawerOverlayId: number | null = null;

watch(audioMode, (on) => {
  if (on && audioModeOverlayId === null) {
    audioModeOverlayId = registerOverlay(() => exitAudioMode());
  } else if (!on && audioModeOverlayId !== null) {
    unregisterOverlay(audioModeOverlayId);
    audioModeOverlayId = null;
  }
});

watch(contextDrawerOpen, (on) => {
  if (on && contextDrawerOverlayId === null) {
    contextDrawerOverlayId = registerOverlay(() => { contextDrawerOpen.value = false; });
  } else if (!on && contextDrawerOverlayId !== null) {
    unregisterOverlay(contextDrawerOverlayId);
    contextDrawerOverlayId = null;
  }
});

onUnmounted(() => {
  if (audioModeOverlayId !== null) unregisterOverlay(audioModeOverlayId);
  if (contextDrawerOverlayId !== null) unregisterOverlay(contextDrawerOverlayId);
});

const mattersList = ref<{ id: string; name: string; caseNumber: string }[]>([]);
const deadlinesList = ref<{ id: string; name: string; matterName: string }[]>([]);
const usersList = ref<{ id: string; name: string; role: string; avatar?: string }[]>([]);
const contextLoading = ref(false);

watch(contextDrawerOpen, async (isOpen) => {
  if (!isOpen) { contextSearch.value = ''; return; }
  if (mattersList.value.length > 0) return;

  contextLoading.value = true;
  try {
    const [mattersRes, deadlinesRes, usersRes] = await Promise.all([
      getMatters(1, 100, { sort: '-created' }),
      getAllDeadlines({ sort: '-date', filter: "status = 'pending'", expand: 'matter', fields: 'id,name,date,expand.matter.name' }),
      getOrganisationUsers(1, 100, {}),
    ]);

    mattersList.value = (mattersRes.items ?? []).map((m: any) => ({
      id: m.id, name: m.name, caseNumber: m.caseNumber,
    }));

    deadlinesList.value = (deadlinesRes ?? []).map((d: any) => ({
      id: d.id, name: d.name, matterName: d.expand?.matter?.name ?? '',
    }));

    usersList.value = (usersRes.items ?? []).map((u: any) => ({
      id: u.id, name: u.name, role: u.organisationRole ?? u.role ?? '', avatar: u.avatar,
    }));

    selectedItems.value = selectedItems.value.map(item => {
      if (item.type === 'matter' && item.label === 'Loading…') {
        const found = mattersList.value.find(m => m.id === item.id);
        return found ? { ...item, label: found.name, sublabel: found.caseNumber } : item;
      }
      return item;
    });
  } finally {
    contextLoading.value = false;
  }
});

const q = computed(() => contextSearch.value.toLowerCase());

const filteredMatters = computed(() =>
  q.value
    ? mattersList.value.filter(m => m.name.toLowerCase().includes(q.value) || m.caseNumber?.toLowerCase().includes(q.value))
    : mattersList.value,
);

const filteredDeadlines = computed(() =>
  q.value
    ? deadlinesList.value.filter(d => d.name.toLowerCase().includes(q.value) || d.matterName.toLowerCase().includes(q.value))
    : deadlinesList.value,
);

const filteredUsers = computed(() =>
  q.value ? usersList.value.filter(u => u.name.toLowerCase().includes(q.value)) : usersList.value,
);

// ── Per-message TTS ───────────────────────────────────────────────────────────
const speakingIdx = ref<number | null>(null);

watch(isSpeaking, (speaking) => {
  if (!speaking) speakingIdx.value = null;
});

function toggleSpeak(content: string, idx: number) {
  if (speakingIdx.value === idx) {
    stopSpeaking();
  } else {
    stopSpeaking();
    speakingIdx.value = idx;
    speak(content);
  }
}

// ── Messaging ─────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }));
}

async function send(voiceText?: string) {
  const text = voiceText ?? inputText.value.trim();
  const hasAttachments = !voiceText && attachments.value.length > 0;
  // Allow attachments-only sends; voice path never carries attachments.
  if (!text && !hasAttachments) return;
  if (loading.value || !aiEnabled.value) return;

  // Build either a plain text turn (back-compat with persisted history) or a
  // multimodal content-block array. Document/image blocks come first so the
  // text reads as a caption to what's attached.
  let userContent: string | AiContentBlock[];
  const userAttachments: ConvAttachment[] = [];
  if (hasAttachments) {
    const blocks: AiContentBlock[] = [];
    for (const a of attachments.value) {
      // Build the transmitted `data` string once, hash it for the metadata
      // side-channel (backend names + dedups the persisted file by this hash).
      let data: string;
      if (a.kind === 'text') {
        // Prefix the filename so the model knows the document's name/type.
        data = `# ${a.name}\n\n${a.text ?? ''}`;
        blocks.push({ type: 'document', source: { type: 'text', media_type: 'text/plain', data } });
      } else if (a.mime === 'application/pdf') {
        data = a.base64 as string;
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
      } else {
        data = a.base64 as string;
        blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mime as AiImageMediaType, data } });
      }
      const sha256 = await attachmentSha256(data);
      sentAttachmentsMeta.value.push({ sha256, name: a.name, mime: a.mime, kind: a.kind, size: a.size });
      userAttachments.push({ sha256, name: a.name, mime: a.mime, kind: a.kind, size: a.size });
      // Resolve a usable URL now so chips preview immediately (before any reload).
      // Object URLs (not data: URLs) so the previewer's XHR fetch works reliably.
      const url = a.kind === 'text'
        ? URL.createObjectURL(new Blob([a.text ?? ''], { type: a.mime || 'text/plain' }))
        : base64ToObjectUrl(a.base64 as string, a.mime);
      if (url && sha256) attachmentUrls.value.set(sha256, url);
    }
    blocks.push({ type: 'text', text: text || 'Help me create a matter from this.' });
    userContent = blocks;
  } else {
    userContent = text;
  }

  dropTrailingPlaceholder();
  branches.append({ role: 'user', content: userContent, attachments: userAttachments.length ? userAttachments : undefined });
  if (!voiceText) {
    inputText.value = '';
    if (hasAttachments) attachments.value = [];
  }
  pendingProposal.value = null;
  loading.value = true;
  voiceState.value = 'thinking';
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
    tier: chatTier.value,
    signal: turnAbort.signal,
  });
  turnAbort = null;
  const elapsedMs = Date.now() - workStartedAt.value;
  // Only the real tool steps are worth keeping as a summary; the synthetic
  // "Assessing"/"Drafting" bookends (tool === '') are dropped so a trivial reply
  // shows no summary at all.
  const turnSteps = activeSteps.value.filter(s => s.tool);
  activeSteps.value = [];
  loading.value = false;

  // The user hit Stop: drop the turn quietly (no assistant bubble, no error). The
  // user bubble stays so they can edit/resend.
  if (response.aborted) {
    // Session-only placeholder (not persisted) — reads as a note and offers Retry.
    branches.append({ role: 'assistant', content: 'Response stopped.', stopped: true });
    voiceState.value = 'idle';
    scrollToBottom();
    return;
  }

  // Reflect the credit gate: a degraded reply still lands (lighter model); a
  // blocked reply (402) locks the composer until the user tops up.
  creditDegraded.value = !!response.degraded;
  if (response.blocked) creditBlocked.value = true;
  refreshAiUsage(); // this round just spent credits — tick the gauge

  if (response.type === 'text') {
    branches.append({
      role: 'assistant',
      content: response.content ?? '',
      steps: turnSteps.length ? turnSteps : undefined,
      durationMs: turnSteps.length ? elapsedMs : undefined,
      stepsOpen: false,
      citations: response.citations?.length ? response.citations : undefined,
      tier: response.tier,
    });
    if (response.conversationId) {
      const isNew = !conversationId.value;
      conversationId.value = response.conversationId;
      if (isNew && historyLoaded.value) {
        await refreshHistory();
      } else if (!isNew && historyLoaded.value) {
        const idx = conversations.value.findIndex(c => c.id === response.conversationId);
        if (idx >= 0) conversations.value[idx]!.updated = new Date().toISOString();
      }
      if (sentAttachmentsMeta.value.length) refreshPromotion();
    }
    persistTree();
    if (audioMode.value) speakTimed(response.content ?? '');
    else voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    // Session-only error placeholder (not persisted) — offers Retry.
    branches.append({ role: 'assistant', content: response.error ?? 'Something went wrong.', failed: true });
    voiceState.value = 'idle';
  }

  scrollToBottom();
}

// Edit an earlier user turn: fork a sibling branch carrying the new text and resend
// from there. The previous branch (and its replies) stays reachable via the version
// arrows.
async function saveEdit(index: number) {
  const text = editDraft.value.trim();
  cancelEdit();
  if (!text || loading.value || !aiEnabled.value) return;
  branches.fork(index, { role: 'user', content: text });
  pendingProposal.value = null;
  loading.value = true;
  voiceState.value = 'thinking';
  activeSteps.value = [];
  workStartedAt.value = Date.now();
  scrollToBottom();

  turnAbort = new AbortController();
  const response = await sendAiMessageStream(apiMessages.value, buildContext(), conversationId.value || undefined, {
    onStep: (s) => { activeSteps.value = [...activeSteps.value, s]; scrollToBottom(); },
    tier: chatTier.value,
    signal: turnAbort.signal,
  });
  turnAbort = null;
  const elapsedMs = Date.now() - workStartedAt.value;
  const turnSteps = activeSteps.value.filter(s => s.tool);
  activeSteps.value = [];
  loading.value = false;

  if (response.aborted) {
    // Session-only placeholder (not persisted) — reads as a note and offers Retry.
    branches.append({ role: 'assistant', content: 'Response stopped.', stopped: true });
    voiceState.value = 'idle';
    scrollToBottom();
    return;
  }

  creditDegraded.value = !!response.degraded;
  if (response.blocked) creditBlocked.value = true;
  refreshAiUsage();

  if (response.type === 'text') {
    branches.append({
      role: 'assistant',
      content: response.content ?? '',
      steps: turnSteps.length ? turnSteps : undefined,
      durationMs: turnSteps.length ? elapsedMs : undefined,
      stepsOpen: false,
      citations: response.citations?.length ? response.citations : undefined,
      tier: response.tier,
    });
    if (response.conversationId) conversationId.value = response.conversationId;
    persistTree();
    voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    // Session-only error placeholder (not persisted) — offers Retry.
    branches.append({ role: 'assistant', content: response.error ?? 'Something went wrong.', failed: true });
    voiceState.value = 'idle';
  }
  scrollToBottom();
}

// If the latest turn is a session-only failed/stopped placeholder, drop it before
// the next action so it never enters the persisted tree or the model's context.
function dropTrailingPlaceholder() {
  const last = messages.value[messages.value.length - 1] as DisplayAiMessage | undefined;
  if (last && (last.failed || last.stopped)) branches.popActive();
}

// Retry a failed turn: drop the error bubble (the active leaf) and resend from the
// preceding user turn, which is left in place. The new reply replaces the error.
async function retryTurn() {
  if (loading.value || !aiEnabled.value) return;
  branches.popActive();
  pendingProposal.value = null;
  loading.value = true;
  voiceState.value = 'thinking';
  activeSteps.value = [];
  workStartedAt.value = Date.now();
  scrollToBottom();

  turnAbort = new AbortController();
  const response = await sendAiMessageStream(apiMessages.value, buildContext(), conversationId.value || undefined, {
    onStep: (s) => { activeSteps.value = [...activeSteps.value, s]; scrollToBottom(); },
    attachmentsMeta: sentAttachmentsMeta.value,
    tier: chatTier.value,
    signal: turnAbort.signal,
  });
  turnAbort = null;
  const elapsedMs = Date.now() - workStartedAt.value;
  const turnSteps = activeSteps.value.filter(s => s.tool);
  activeSteps.value = [];
  loading.value = false;

  if (response.aborted) {
    // Session-only placeholder (not persisted) — reads as a note and offers Retry.
    branches.append({ role: 'assistant', content: 'Response stopped.', stopped: true });
    voiceState.value = 'idle';
    scrollToBottom();
    return;
  }

  creditDegraded.value = !!response.degraded;
  if (response.blocked) creditBlocked.value = true;
  refreshAiUsage();

  if (response.type === 'text') {
    branches.append({
      role: 'assistant',
      content: response.content ?? '',
      steps: turnSteps.length ? turnSteps : undefined,
      durationMs: turnSteps.length ? elapsedMs : undefined,
      stepsOpen: false,
      citations: response.citations?.length ? response.citations : undefined,
      tier: response.tier,
    });
    if (response.conversationId) conversationId.value = response.conversationId;
    persistTree();
    if (audioMode.value) speakTimed(response.content ?? '');
    else voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    // Session-only error placeholder (not persisted) — offers Retry.
    branches.append({ role: 'assistant', content: response.error ?? 'Something went wrong.', failed: true });
    voiceState.value = 'idle';
  }
  scrollToBottom();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function prefill(text: string) { inputText.value = text; }

// Imperative API for the useAiChat composable (entry points outside the chat,
// e.g. the "Create with AI" card on the create-matter page, signal here to
// seed text and/or attachments before the user hits send).
defineExpose({
  prefill,
  addFiles,
});

// Watch the global open-request signal (written by useAiChat().open()).
// When set, open this chat, drop the seed text into the input, run any
// File objects through the same validation pipeline as the paperclip, then
// clear the signal so the next open is independent.
const aiChat = useAiChat();
watch(() => aiChat.request.value?.requestedAt, async (ts) => {
  if (!ts) return;
  const req = aiChat.request.value;
  if (!req) return;
  open.value = true;
  if (req.seedText) prefill(req.seedText);
  if (req.seedAttachments && req.seedAttachments.length > 0) {
    await addFiles(req.seedAttachments);
  }
  aiChat.consume();
});

function goToBilling() {
  open.value = false;
  navigateTo('/main/settings/billing');
}

function dismissProposal() {
  if (pendingProposal.value) {
    branches.append({ role: 'tool-event', content: formatToolName(pendingProposal.value.tool ?? ''), status: 'rejected' });
    persistTree();
  }
  pendingProposal.value = null;
}

/** Hand off an AI-extracted matter draft to the manual create-matter form.
 *  Stashes the draft + extracted fields in sessionStorage so the page can
 *  hydrate its store on mount, then closes the chat and navigates over. */
function handoffMatterDraft() {
  const preview = pendingProposal.value?.preview;
  if (preview?.kind !== 'create_matter') return;
  try {
    sessionStorage.setItem('practocore.matterDraft', JSON.stringify({
      template: preview.template,
      matter: preview.matter,
      fields: preview.fields,
    }));
  } catch {
    // sessionStorage can be unavailable (private browsing edge cases); navigate
    // anyway — the user keeps a manual entry point.
  }
  pendingProposal.value = null;
  open.value = false;
  navigateTo('/main/matters/create');
}

const proposalLoading = ref(false);

async function approveProposal() {
  if (!pendingProposal.value || proposalLoading.value) return;
  // Approving applies matter changes (fulfill/adjourn/edit) — block when the
  // subscription has lapsed. The proposal stays pending so it can be applied
  // once the plan is renewed.
  if (!isSubscriptionActive.value) {
    branches.append({ role: 'assistant', content: 'Your subscription has expired. Renew your plan to apply changes.' });
    return;
  }
  proposalLoading.value = true;
  const proposal = pendingProposal.value;
  pendingProposal.value = null;

  branches.append({ role: 'tool-event', content: formatToolName(proposal.tool ?? ''), status: 'approved' });
  loading.value = true;
  voiceState.value = 'thinking';
  scrollToBottom();

  const response = await confirmAiProposal(
    proposal,
    true,
    buildContext(),
    conversationId.value || undefined,
    convMessages.value,
    false,
    sentAttachmentsMeta.value,
  );
  loading.value = false;
  proposalLoading.value = false;

  creditDegraded.value = !!response.degraded;
  refreshAiUsage();

  if (response.type === 'text') {
    branches.append({
      role: 'assistant',
      content: response.content ?? '',
      citations: response.citations?.length ? response.citations : undefined,
      tier: response.tier,
    });
    if (response.conversationId) {
      conversationId.value = response.conversationId;
      if (historyLoaded.value) refreshHistory();
      if (sentAttachmentsMeta.value.length) refreshPromotion();
    }
    persistTree();
    if (audioMode.value) speakTimed(response.content ?? '');
    else voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    branches.append({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
    persistTree();
    voiceState.value = 'idle';
  }

  // The executed write-tool's structured output (actionResult) is independent of
  // the conversational reply type: the follow-up turn may come back as text OR as
  // another approval proposal (e.g. the model chains into save_memory after a
  // generate_document). Surface the action card regardless, or it gets silently
  // dropped whenever the reply isn't plain text.
  applyApprovedActionResult(response);

  scrollToBottom();
}

// Appends the in-chat card / toast for a successfully executed write-tool. Driven
// purely by the backend's structured actionResult, so it works whether the
// follow-up reply is text or another proposal. For create_matter_draft we DON'T
// force-navigate — the reply already confirms it; we append a tappable card so the
// user opens the matter when they're ready, and refresh the matters cache.
function applyApprovedActionResult(response: AiResponse) {
  const action = response.actionResult;
  if (!action) return;

  if (action.tool === 'create_matter_draft') {
    const matterId = action.data?.matterId;
    if (matterId && typeof matterId === 'string') {
      const matterName = action.data?.name as string | undefined;
      toast('Matter created', {
        description: matterName ? `"${matterName}" is ready.` : 'Your new matter is ready.',
      });
      branches.append({ role: 'matter-created', matterId, matterName });
      useMattersStore().fetchMatters(true).catch(() => {});
    }
  } else if (action.tool === 'schedule_reminder' && action.data?.success) {
    const reminderTitle = action.data?.title as string | undefined;
    toast('Reminder scheduled', {
      description: reminderTitle ? `"${reminderTitle}" is set.` : 'Your reminder is set.',
    });
    branches.append({ role: 'reminder-created', reminderTitle });
  } else if (action.tool === 'generate_document' && action.data?.success) {
    const d = action.data;
    const title = d?.title as string | undefined;
    track('document_generated', { kind: (d?.kind as string) || 'generic', from: 'chat' });
    toast('Document drafted', {
      description: title ? `"${title}" is ready to download.` : 'Your document is ready to download.',
    });
    branches.append({
      role: 'document-generated',
      documentId: d?.documentId as string,
      title,
      kind: d?.kind as string | undefined,
      filename: d?.filename as string | undefined,
    });
  }
  persistTree();
}

// User-initiated open of a just-created matter (from the in-chat card). Closes
// the chat first so navigation lands on a clean matter page.
function openMatter(matterId: string) {
  open.value = false;
  navigateTo(`/main/matters/matter/${matterId}`);
}

function openReminders() {
  open.value = false;
  navigateTo('/main/reminder');
}

// Download a just-generated document. Fetches the row by id (cheap, cached by the
// SDK) so we don't have to thread the full record through the chat message, then
// streams the .docx via a tokenised file URL.
const downloadingDocId = ref<string | null>(null);
async function downloadGeneratedDocument(documentId: string) {
  if (!documentId) return;
  downloadingDocId.value = documentId;
  try {
    const { pb } = await import('~/lib/pocketbase');
    const { downloadDocument } = await import('~/services/documents');
    const doc = await pb.collection('GeneratedDocuments').getOne(documentId);
    await downloadDocument(doc as any);
  } catch (e) {
    toast('Could not download the document', { description: 'Please try again.' });
  } finally {
    downloadingDocId.value = null;
  }
}

function formatToolName(tool: string): string {
  return tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
</script>

<template>
  <!-- Adaptive: Dialog on desktop, Sheet on mobile -->
  <component :is="isDesktop ? Dialog : Sheet" v-model:open="open">
    <component :is="isDesktop ? DialogTrigger : SheetTrigger" v-if="$slots.default" as-child>
      <slot />
    </component>

    <component
      :is="isDesktop ? DialogContent : SheetContent"
      :side="isDesktop ? undefined : 'bottom'"
      :class="isDesktop
        ? 'flex flex-col p-0 gap-0 overflow-hidden w-[760px] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] h-[82vh] max-h-[82vh]'
        : ['flex flex-col p-0 gap-0 overflow-hidden', (messages.length > 0 || audioMode || historyOpen) ? 'h-dvh' : 'h-auto']"
      :hideX="true"
      @escape-key-down="(e: Event) => { if (contextDrawerOpen) { e.preventDefault(); contextDrawerOpen = false; } }"
      @pointer-down-outside="(e: Event) => { if (contextDrawerOpen) e.preventDefault(); }"
    >

      <!-- ═══════════════════════════════════════════════════════
           AUDIO MODE
      ══════════════════════════════════════════════════════════ -->
      <Transition name="audio-mode">
        <div v-if="audioMode" class="absolute inset-0 flex flex-col bg-background overflow-hidden" style="z-index: 10">

          <!-- Top bar -->
          <div class="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div class="flex items-center gap-2">
              <div class="size-2 rounded-full bg-primary animate-pulse" />
              <span class="text-sm font-medium text-primary">Live</span>
            </div>
            <Button size="icon-sm" variant="ghost" title="Back to chat" @click="exitAudioMode">
              <MessageSquare class="size-4" />
            </Button>
          </div>

          <!-- Proposal card -->
          <Transition name="fade">
            <ProposalCard
              v-if="pendingProposal"
              :proposal="pendingProposal"
              variant="panel"
              :loading="proposalLoading"
              class="mx-4 mt-3 shrink-0"
              @approve="approveProposal"
              @dismiss="dismissProposal"
              @edit-manually="handoffMatterDraft"
            />
          </Transition>

          <!-- Center — orb + contextual text -->
          <div class="flex-1 flex flex-col items-center justify-center gap-6 px-8">

            <!-- Orb -->
            <div class="relative flex items-center justify-center size-36">
              <div
                class="absolute size-36 rounded-full bg-primary/8 transition-transform duration-75 ease-out"
                :style="{ transform: `scale(${outerRingScale})` }"
              />
              <div
                class="absolute size-36 rounded-full bg-primary/12 transition-transform duration-75 ease-out"
                :style="{ transform: `scale(${innerRingScale})` }"
              />
              <div
                class="relative z-10 size-24 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-2xl shadow-primary/25 transition-all duration-300"
                :class="{
                  'scale-105': voiceState === 'listening',
                  'animate-pulse': voiceState === 'speaking',
                }"
              >
                <template v-if="voiceState === 'listening'">
                  <div class="flex items-end gap-1 h-9">
                    <div
                      v-for="i in 7" :key="i"
                      class="w-1 bg-primary-foreground rounded-full transition-all duration-75 ease-out"
                      :style="{ height: `${barHeight(i)}px` }"
                    />
                  </div>
                </template>
                <template v-else-if="voiceState === 'thinking'">
                  <Loader2 class="size-8 animate-spin opacity-90" />
                </template>
                <template v-else>
                  <Sparkles class="size-8 opacity-90" />
                </template>
              </div>
            </div>

            <!-- State label + last exchange -->
            <div class="w-full max-w-xs text-center space-y-1 min-h-[3.5rem] flex flex-col items-center justify-center">
              <Transition name="fade" mode="out-in">
                <p v-if="voiceState === 'listening' && transcript" key="t" class="text-foreground text-lg font-medium leading-snug">{{ transcript }}</p>
                <p v-else-if="voiceState === 'listening'" key="l" class="text-primary text-sm font-medium animate-pulse">Listening…</p>
                <p v-else-if="voiceState === 'thinking'" key="th" class="text-muted-foreground text-sm">Thinking…</p>
                <p v-else-if="voiceState === 'speaking' && caption" key="spc" class="text-foreground text-sm leading-relaxed line-clamp-4">{{ caption }}</p>
                <p v-else-if="voiceState === 'speaking'" key="sp" class="text-primary text-sm font-medium animate-pulse">Speaking…</p>
                <div v-else-if="lastAssistantText" key="ex" class="space-y-1">
                  <p v-if="lastUserText" class="text-muted-foreground/60 text-xs truncate">{{ lastUserText }}</p>
                  <p class="text-muted-foreground text-sm leading-relaxed line-clamp-3">{{ lastAssistantText }}</p>
                </div>
                <p v-else key="empty" class="text-muted-foreground text-sm">Tap the mic and start talking</p>
              </Transition>
            </div>

          </div>

          <!-- Bottom controls -->
          <div class="flex items-center justify-center gap-3 px-6 pb-6 pt-2 border-t shrink-0">

            <!-- Context -->
            <Button
              size="icon"
              variant="ghost"
              class="rounded-full relative"
              @click="contextDrawerOpen = true"
            >
              <AtSign class="size-5" />
              <span v-if="selectedItems.length" class="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary rounded-full text-[9px] text-primary-foreground grid place-items-center font-semibold px-1">
                {{ selectedItems.length }}
              </span>
            </Button>

            <!-- Stop speaking -->
            <Button
              v-if="isSpeaking"
              size="icon"
              variant="ghost"
              class="rounded-full"
              @click="stopSpeaking"
            >
              <VolumeX class="size-5" />
            </Button>

            <!-- Mic toggle — primary action -->
            <Button
              size="icon"
              class="size-16 rounded-full [&_svg]:size-6 shadow-lg shadow-primary/20"
              :variant="isListening ? 'destructive' : 'default'"
              :class="isListening ? 'ring-4 ring-destructive/20' : ''"
              :disabled="voiceState === 'thinking'"
              @click="toggleMic"
            >
              <MicOff v-if="isListening" />
              <Mic v-else />
            </Button>

            <!-- Exit -->
            <Button size="icon" variant="destructive" class="rounded-full" @click="exitAudioMode">
              <X class="size-5" />
            </Button>

          </div>

        </div>
      </Transition>

      <!-- ═══════════════════════════════════════════════════════
           CHAT MODE
      ══════════════════════════════════════════════════════════ -->

      <!-- Header -->
      <div class="flex items-center px-4 py-3 border-b shrink-0 gap-2">
        <div class="size-7 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full">
          <Sparkles class="size-3.5" />
        </div>
        <span class="font-semibold text-sm">PractoAI</span>
        <div class="ml-auto flex items-center gap-1">
          <AICreditGauge />
          <Button v-if="messages.length > 0 || conversationId" size="icon-sm" variant="ghost" title="New chat" :disabled="loading" @click="newChat">
            <SquarePen class="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" :class="historyOpen ? 'text-primary' : ''" @click="historyOpen = !historyOpen">
            <History class="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" title="Voice settings" @click="voiceSettingsOpen = true">
            <Settings class="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" @click="open = false">
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <!-- Body: history + chat -->
      <div class="flex flex-1 min-h-0 overflow-hidden">

        <!-- History panel -->
        <Transition name="history-panel">
          <div v-if="historyOpen" class="history-panel-inner w-60 shrink-0 border-r flex flex-col overflow-y-scroll">
            <div class="px-3 py-2 border-b shrink-0">
              <Button size="sm" variant="outline" class="w-full gap-1.5" @click="newChat">
                <Plus class="size-3.5" /> New Chat
              </Button>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="historyLoading" class="flex items-center justify-center py-8">
                <Loader2 class="size-4 animate-spin text-muted-foreground" />
              </div>
              <template v-else-if="conversations.length > 0">
                <button
                  v-for="conv in conversations" :key="conv.id"
                  class="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-0 group flex items-start gap-2"
                  :class="conversationId === conv.id ? 'bg-accent' : ''"
                  @click="loadConversation(conv.id)"
                >
                  <MessageSquare class="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium truncate leading-snug">{{ conv.title }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ relativeTime(conv.updated) }}</p>
                  </div>
                  <button class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive" @click.stop="removeConversation(conv.id)">
                    <Trash2 class="size-3.5" />
                  </button>
                </button>
              </template>
              <p v-else class="px-3 py-6 text-xs text-muted-foreground text-center">No conversations yet.</p>
            </div>
          </div>
        </Transition>

        <!-- Chat area -->
        <div class="flex flex-col flex-1 min-h-0">

          <!-- Messages / empty state -->
          <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
            <template v-if="messages.length === 0 && !loading">
              <div class="flex flex-col gap-1">
                <div class="size-10 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full font-semibold">
                  <Sparkles class="size-4" />
                </div>
                <span class="text-base font-medium mt-2">Hi {{ firstName }}! How can I help you today?</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-sm text-muted-foreground">Suggested</span>
                <div class="flex flex-col gap-1">
                  <Button variant="secondary" size="xs" class="w-fit" @click="prefill('Ask a question')">Ask a question</Button>
                  <Button variant="secondary" size="xs" class="w-fit" @click="prefill('Create a matter')">Create a matter</Button>
                </div>
              </div>
            </template>

            <template v-for="(msg, i) in messages" :key="i">
              <div v-if="msg.role === 'tool-event'" class="flex justify-center">
                <span
                  class="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border"
                  :class="msg.status === 'approved'
                    ? 'text-muted-foreground border bg-muted'
                    : 'text-muted-foreground border-border bg-muted/40'"
                >
                  <Check v-if="msg.status === 'approved'" class="size-3" />
                  <X v-else class="size-3" />
                  {{ msg.status === 'approved' ? 'Approved' : 'Dismissed' }}: {{ msg.content }}
                </span>
              </div>
              <!-- Open-matter card: shown after the assistant confirms a creation,
                   so the user opens it on their own terms (no forced navigation). -->
              <div v-else-if="msg.role === 'matter-created'" class="flex">
                <button
                  type="button"
                  class="group/open flex items-center gap-3 max-w-[80%] rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
                  @click="openMatter(msg.matterId)"
                >
                  <div class="size-8 rounded-md grid place-items-center shrink-0 bg-primary/10 text-primary">
                    <Briefcase class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate">{{ msg.matterName || 'New matter' }}</p>
                    <p class="text-xs text-muted-foreground">Open matter</p>
                  </div>
                  <ArrowRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover/open:translate-x-0.5" />
                </button>
              </div>
              <!-- Open-reminders card: shown after the assistant confirms a reminder. -->
              <div v-else-if="msg.role === 'reminder-created'" class="flex">
                <button
                  type="button"
                  class="group/open flex items-center gap-3 max-w-[80%] rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
                  @click="openReminders()"
                >
                  <div class="size-8 rounded-md grid place-items-center shrink-0 bg-primary/10 text-primary">
                    <Bell class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate">{{ msg.reminderTitle || 'Reminder set' }}</p>
                    <p class="text-xs text-muted-foreground">Open reminders</p>
                  </div>
                  <ArrowRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover/open:translate-x-0.5" />
                </button>
              </div>
              <!-- Download card: shown after the assistant drafts a .docx document. -->
              <div v-else-if="msg.role === 'document-generated'" class="flex">
                <button
                  type="button"
                  class="group/open flex items-center gap-3 max-w-[80%] rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
                  :disabled="downloadingDocId === msg.documentId"
                  @click="downloadGeneratedDocument(msg.documentId)"
                >
                  <div class="size-8 rounded-md grid place-items-center shrink-0 bg-primary/10 text-primary">
                    <FileType2 class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate">{{ msg.title || 'New document' }}</p>
                    <p class="text-xs text-muted-foreground capitalize">
                      {{ msg.kind ? `${msg.kind} · ` : '' }}Download .docx
                    </p>
                  </div>
                  <Loader2 v-if="downloadingDocId === msg.documentId" class="size-4 shrink-0 text-muted-foreground animate-spin" />
                  <Download v-else class="size-4 shrink-0 text-muted-foreground transition-transform group-hover/open:translate-y-0.5" />
                </button>
              </div>
              <div v-else-if="msg.role === 'user'" class="group flex justify-end">
                <!-- Inline editor (editing this turn forks a new branch on save) -->
                <div v-if="editingIndex === i" class="flex w-full max-w-[80%] flex-col items-end gap-2">
                  <textarea v-model="editDraft" rows="3"
                            class="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
                            @keydown.escape="cancelEdit"
                            @keydown.enter.exact.prevent="saveEdit(i)"/>
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="ghost" class="h-7" @click="cancelEdit">Cancel</Button>
                    <Button size="sm" class="h-7" :disabled="!editDraft.trim()" @click="saveEdit(i)">Send</Button>
                  </div>
                </div>

                <div v-else class="flex flex-col items-end gap-1 max-w-[80%]">
                  <!-- Attachment chips above the text bubble — only present on multimodal turns -->
                  <MessageAttachments v-if="messageChips(msg).length" :attachments="messageChips(msg)" align="end" @preview="openPreview"/>
                  <div
                    v-if="stripAttachmentPlaceholders(messageText(msg.content))"
                    class="bg-muted text-muted-foreground border rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
                  >
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
              <div v-else class="flex items-start gap-2 group/msg">
                <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
                  <Sparkles class="size-3" />
                </div>
                <div class="flex flex-col gap-0.5 max-w-[80%]">
                  <!-- Collapsed activity summary for turns that ran tools. Click to
                       expand the steps that produced this answer. -->
                  <div v-if="msg.steps && msg.steps.length" class="mb-1">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      @click="msg.stepsOpen = !msg.stepsOpen"
                    >
                      <Check class="size-3 text-emerald-500" />
                      <span>Worked for {{ formatDuration(msg.durationMs ?? 0) }}</span>
                      <component :is="msg.stepsOpen ? ChevronDown : ChevronRight" class="size-3" />
                    </button>
                    <ul v-if="msg.stepsOpen" class="mt-1.5 ml-1 flex flex-col gap-1 border-l border-border pl-3">
                      <li v-for="step in msg.steps" :key="step.id" class="flex items-center gap-2 text-xs text-muted-foreground">
                        <component :is="stepIcon(step.tool)" class="size-3 shrink-0 opacity-70" />
                        <span class="min-w-0 truncate">{{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{ step.detail }}</span></span>
                      </li>
                    </ul>
                  </div>
                  <!-- A user-stopped turn reads as a neutral note, not an answer/error. -->
                  <div v-if="(msg as DisplayAiMessage).stopped"
                       class="text-sm italic text-muted-foreground px-0.5 py-1">
                    Response stopped.
                  </div>
                  <div v-else class="border rounded-lg px-3 py-2 text-sm"
                       :class="(msg as DisplayAiMessage).failed ? 'bg-destructive/5 border-destructive/30 text-destructive' : 'bg-background text-foreground'">
                    <SharedAICitationsCitedAnswer
                      :content="messageText(msg.content)"
                      :citations="(msg as DisplayAiMessage).citations"
                    />
                  </div>
                  <!-- Which model served this reply, so the credit cost is legible. -->
                  <div
                    v-if="msgTierLabel(msg)"
                    class="flex items-center gap-1 text-[11px] text-muted-foreground px-0.5 mt-0.5"
                  >
                    <component :is="msgTierIcon(msg)" class="size-3" />
                    <span>{{ msgTierLabel(msg) }}</span>
                  </div>
                  <!-- Retry a failed/stopped turn (only the latest — retry drops the active leaf) -->
                  <button
                    v-if="((msg as DisplayAiMessage).failed || (msg as DisplayAiMessage).stopped) && i === messages.length - 1 && !loading"
                    type="button"
                    class="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-0.5"
                    @click="retryTurn"
                  >
                    <RotateCcw class="size-3" />
                    Retry
                  </button>
                  <button
                    v-else
                    class="self-start flex items-center gap-1 text-muted-foreground hover:text-foreground transition-all opacity-40 sm:opacity-0 sm:group-hover/msg:opacity-100 px-0.5"
                    :class="speakingIdx === i ? '!opacity-100 text-primary' : ''"
                    @click="toggleSpeak(messageText(msg.content), i)"
                  >
                    <VolumeX v-if="speakingIdx === i" class="size-3" />
                    <Volume2 v-else class="size-3" />
                  </button>
                </div>
              </div>
            </template>

            <!-- Live "Working…" panel: shows the real tool steps as they stream in,
                 last one spinning. Replaces the old bare spinner. -->
            <div v-if="loading" class="flex items-start gap-2">
              <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
                <Sparkles class="size-3" />
              </div>
              <div class="min-w-0 flex-1 pt-1">
                <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Loader2 class="size-3.5 animate-spin text-muted-foreground" />
                  <span>Working…</span>
                </div>
                <ul v-if="activeSteps.length" class="mt-2 flex flex-col gap-1.5">
                  <li
                    v-for="(step, idx) in activeSteps"
                    :key="step.id"
                    class="flex items-center gap-2 text-xs"
                  >
                    <Loader2 v-if="idx === activeSteps.length - 1" class="size-3 shrink-0 animate-spin text-muted-foreground" />
                    <Check v-else class="size-3 shrink-0 text-emerald-500" />
                    <span
                      class="min-w-0 truncate"
                      :class="idx === activeSteps.length - 1 ? 'text-foreground' : 'text-muted-foreground'"
                    >
                      {{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{ step.detail }}</span>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div class="max-w-[80%]">
              <ProposalCard
                v-if="pendingProposal"
                :proposal="pendingProposal"
                variant="panel"
                :loading="proposalLoading"
                @approve="approveProposal"
                @dismiss="dismissProposal"
                @edit-manually="handoffMatterDraft"
              />
            </div>

            <div ref="messagesEnd" />
          </div>

          <!-- Input area -->
          <div class="shrink-0 px-4 py-3 border-t flex flex-col gap-2">
            <!-- Subscription gate — quiet inline notice -->
            <div v-if="!isSubscriptionActive" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock class="size-3 shrink-0" />
              <span>
                Chatting with PractoAI needs an active subscription.
                <button class="underline font-medium hover:text-foreground" @click="goToBilling">Renew</button>
              </span>
            </div>

            <!-- Credit gate — blocked (locked) -->
            <div v-else-if="creditBlocked" class="flex items-center gap-1.5 text-xs text-destructive">
              <Lock class="size-3 shrink-0" />
              <span>
                AI credit limit reached.
                <button class="underline font-medium hover:opacity-80" @click="goToBilling">Top up</button>
                to keep using AI.
              </span>
            </div>

            <!-- Credit gate — degraded (lighter model, still usable) -->
            <div v-else-if="creditDegraded" class="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <Zap class="size-3 shrink-0" />
              <span>
                Pool used up — running on the lighter model.
                <button class="underline font-medium hover:opacity-80" @click="goToBilling">Top up</button>
                to restore full power.
              </span>
            </div>

            <!-- Active context badges -->
            <div v-if="selectedItems.length > 0" class="flex flex-wrap gap-1">
              <Badge
                v-for="item in selectedItems" :key="item.id"
                variant="secondary"
                class="flex items-center gap-1 pr-1"
              >
                <component :is="contextIcons[item.type]" class="size-3 shrink-0" />
                <span class="text-xs max-w-[160px] truncate">{{ item.label }}</span>
                <button class="ml-1 text-muted-foreground hover:text-foreground transition-colors shrink-0" @click="removeItem(item.id)">
                  <X class="size-3" />
                </button>
              </Badge>
            </div>

            <!-- Vault promotion nudge (suggest mode) — non-blocking, dismissable. -->
            <div
              v-if="showPromotionNudge"
              class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
            >
              <Library class="mt-0.5 size-4 shrink-0 text-primary" />
              <p class="min-w-0 flex-1 text-foreground">
                That's {{ promotion.unpromoted }} files in this chat. Move them to a vault so the assistant
                can keep referencing them without re-uploading.
              </p>
              <div class="flex shrink-0 items-center gap-1">
                <Button size="sm" class="h-7 px-2" :disabled="promoting" @click="promoteAttachments">
                  <Library class="size-3.5" />
                  {{ promoting ? 'Moving…' : 'Move to vault' }}
                </Button>
                <button
                  class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Dismiss"
                  @click="promotionDismissed = true"
                >
                  <X class="size-3.5" />
                </button>
              </div>
            </div>

            <!-- Vault ingestion progress (quiet — informs without shouting). -->
            <div v-if="ingest.active" class="px-1 py-0.5">
              <SharedAIIngestRing :done="ingest.done" :total="ingest.total" />
            </div>

            <!-- Pending attachments — chips shown above the input until the next send -->
            <div v-if="attachments.length > 0" class="flex flex-wrap gap-1.5">
              <div
                v-for="att in attachments" :key="att.id"
                class="flex items-center gap-1.5 rounded-md border bg-background pr-1 pl-1 py-1 text-xs"
              >
                <img
                  v-if="att.mime.startsWith('image/')"
                  :src="att.dataUrl"
                  :alt="att.name"
                  class="size-8 rounded object-cover shrink-0"
                />
                <FileText v-else class="size-4 text-muted-foreground shrink-0" />
                <span class="max-w-[140px] truncate font-medium">{{ att.name }}</span>
                <span class="text-muted-foreground">{{ formatBytes(att.size) }}</span>
                <button
                  class="ml-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  :aria-label="`Remove ${att.name}`"
                  @click="removeAttachment(att.id)"
                >
                  <X class="size-3" />
                </button>
              </div>
            </div>

            <!-- Hidden file input — the Paperclip button below triggers it.
                 capture=\"environment\" opens the rear camera on Capacitor/Android
                 from the OS picker, giving us "take a photo" support for free. -->
            <input
              ref="fileInput"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,text/markdown,text/plain,text/*,.md,.markdown,.txt,.text,.csv,.json,.log"
              class="hidden"
              @change="onFilesChosen"
            />

            <InputGroup>
              <InputGroupAddon align="block-start">
                <Button size="sm" variant="outline" :class="selectedItems.length > 0 ? 'border-primary/50 text-primary' : ''" @click="contextDrawerOpen = true">
                  <AtSign class="size-4" />
                  Add Context
                  <Badge v-if="selectedItems.length > 0" variant="secondary" class="ml-1 text-xs px-1">
                    {{ selectedItems.length }}
                  </Badge>
                </Button>
              </InputGroupAddon>

              <InputGroupTextarea
                v-model="inputText"
                :placeholder="composerPlaceholder"
                :disabled="!aiEnabled"
                @keydown="handleKeydown"
              />

              <InputGroupAddon align="block-end">
                <InputGroupButton
                  variant="outline"
                  size="icon-sm"
                  :disabled="!aiEnabled"
                  title="Attach a PDF or image"
                  @click="openFilePicker"
                >
                  <Paperclip class="size-4" />
                  <span class="sr-only">Attach a PDF or image</span>
                </InputGroupButton>
                <InputGroupButton variant="outline" size="sm">
                  <Globe />
                  Sources
                </InputGroupButton>
                <InputGroupButton
                  variant="outline"
                  size="sm"
                  :disabled="!aiEnabled"
                  :title="tierTitle"
                  @click="cycleTier"
                >
                  <component :is="tierIcon" class="size-4" />
                  {{ tierLabel }}
                </InputGroupButton>
                <InputGroupButton
                  variant="outline"
                  size="sm"
                  :disabled="!canEnhance"
                  title="Enhance prompt — rewrite it to get better results"
                  @click="enhancePrompt"
                >
                  <Loader2 v-if="enhancing" class="size-4 animate-spin" />
                  <Sparkles v-else class="size-4" />
                  {{ enhancing ? 'Enhancing…' : 'Enhance' }}
                </InputGroupButton>
                <Separator orientation="vertical" class="!h-4 ml-auto" />
                <InputGroupButton
                  v-if="loading"
                  variant="default"
                  class="rounded-full"
                  size="icon-sm"
                  title="Stop generating"
                  @click="stopTurn"
                >
                  <Square class="size-3.5 fill-current" />
                  <span class="sr-only">Stop generating</span>
                </InputGroupButton>
                <InputGroupButton
                  v-else
                  variant="default"
                  class="rounded-full"
                  size="icon-sm"
                  :disabled="!canSend"
                  @click="send()"
                >
                  <ArrowUpIcon class="size-4" />
                  <span class="sr-only">Send</span>
                </InputGroupButton>
                <!-- Mic → enters audio mode inline -->
                <InputGroupButton
                  variant="default"
                  class="rounded-full"
                  size="icon-sm"
                  title="Voice conversation"
                  :disabled="!aiEnabled"
                  @click="toggleMic"
                >
                  <Mic class="size-4" />
                  <span class="sr-only">Voice conversation</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           CONTEXT PICKER — inline overlay (no nested modal,
           so it can't leave the body with pointer-events: none)
      ══════════════════════════════════════════════════════════ -->
      <Transition name="context-panel">
        <div v-if="contextDrawerOpen" class="absolute inset-0 flex flex-col justify-end" style="z-index: 30">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40" @click="contextDrawerOpen = false" />

          <!-- Panel -->
          <div class="context-panel-sheet relative bg-background rounded-t-xl border-t shadow-xl flex flex-col max-h-[75vh] min-h-0">
            <div class="flex items-center gap-2 px-4 py-3 border-b shrink-0">
              <AtSign class="size-4 text-muted-foreground" />
              <span class="font-semibold text-sm">Add Context</span>
              <Button size="icon-sm" variant="ghost" class="ml-auto" @click="contextDrawerOpen = false">
                <X class="size-4" />
              </Button>
            </div>
            <div class="px-4 pt-3 pb-2 border-b shrink-0">
              <input v-model="contextSearch" placeholder="Search matters, deadlines, lawyers…" class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <Tabs v-model="contextTab" class="flex flex-col flex-1 min-h-0">
              <TabsList class="shrink-0 px-4 py-2 justify-start gap-1 border-b bg-transparent h-auto rounded-none">
                <TabsTrigger value="matter" class="text-xs gap-1.5 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-secondary-foreground"><Building2 class="size-3" /> Matters</TabsTrigger>
                <TabsTrigger value="deadline" class="text-xs gap-1.5 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-secondary-foreground"><Clock class="size-3" /> Deadlines</TabsTrigger>
                <TabsTrigger value="user" class="text-xs gap-1.5 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-secondary-foreground"><User class="size-3" /> Lawyers</TabsTrigger>
              </TabsList>
              <div v-if="contextLoading" class="flex items-center justify-center p-8">
                <Loader2 class="size-5 animate-spin text-muted-foreground" />
              </div>
              <template v-else>
                <TabsContent value="matter" class="overflow-y-auto flex-1 mt-0 pb-8">
                  <template v-if="filteredMatters.length > 0">
                    <button v-for="m in filteredMatters" :key="m.id" class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0" :class="isSelected(m.id) ? 'bg-accent' : ''" @click="toggleItem({ type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber })">
                      <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium truncate">{{ m.name }}</span><span class="text-xs text-muted-foreground">{{ m.caseNumber }}</span></div>
                      <Check v-if="isSelected(m.id)" class="size-4 text-primary shrink-0" />
                    </button>
                  </template>
                  <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">No matters found.</p>
                </TabsContent>
                <TabsContent value="deadline" class="overflow-y-auto flex-1 mt-0 pb-8">
                  <template v-if="filteredDeadlines.length > 0">
                    <button v-for="d in filteredDeadlines" :key="d.id" class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0" :class="isSelected(d.id) ? 'bg-accent' : ''" @click="toggleItem({ type: 'deadline', id: d.id, label: d.name, sublabel: d.matterName })">
                      <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium truncate">{{ d.name }}</span><span class="text-xs text-muted-foreground truncate">{{ d.matterName }}</span></div>
                      <Check v-if="isSelected(d.id)" class="size-4 text-primary shrink-0" />
                    </button>
                  </template>
                  <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">No pending deadlines found.</p>
                </TabsContent>
                <TabsContent value="user" class="overflow-y-auto flex-1 mt-0 pb-8">
                  <template v-if="filteredUsers.length > 0">
                    <button v-for="u in filteredUsers" :key="u.id" class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0" :class="isSelected(u.id) ? 'bg-accent' : ''" @click="toggleItem({ type: 'user', id: u.id, label: u.name, sublabel: u.role })">
                      <Avatar class="size-7 shrink-0">
                        <AvatarImage :src="u.avatar ?? ''" :alt="u.name" />
                        <AvatarFallback class="text-[10px] bg-primary text-primary-foreground">{{ initials(u.name) }}</AvatarFallback>
                      </Avatar>
                      <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium">{{ u.name }}</span><span v-if="u.role" class="text-xs text-muted-foreground capitalize">{{ u.role }}</span></div>
                      <Check v-if="isSelected(u.id)" class="size-4 text-primary shrink-0" />
                    </button>
                  </template>
                  <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">No lawyers found.</p>
                </TabsContent>
              </template>
            </Tabs>
          </div>
        </div>
      </Transition>

    </component>
  </component>

  <!-- Voice settings sheet -->
  <Sheet v-model:open="voiceSettingsOpen">
    <SheetContent side="right" class="flex flex-col gap-0 p-0 w-full sm:max-w-sm overflow-y-auto">
      <div class="flex items-center gap-2 px-4 py-4 border-b shrink-0">
        <Settings class="size-4 text-muted-foreground" />
        <span class="font-semibold text-sm">Voice Settings</span>
      </div>
      <div class="flex flex-col gap-6 px-4 py-5">
        <div class="flex flex-col gap-3">
          <div>
            <p class="text-sm font-medium">Voice</p>
            <p class="text-xs text-muted-foreground mt-0.5">Select the ElevenLabs voice for AI responses</p>
          </div>
          <div v-if="voicesLoading" class="flex justify-center py-6"><Loader2 class="size-5 animate-spin text-muted-foreground" /></div>
          <div v-else-if="voices.length > 0" class="flex flex-col gap-1.5">
            <button
              v-for="v in voices" :key="v.voice_id"
              class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors hover:bg-accent flex items-center justify-between gap-2"
              :class="speechPrefs.voiceId === v.voice_id ? 'border-primary bg-primary/5' : 'border-border'"
              @click="selectVoice(v)"
            >
              <div class="flex items-center gap-2">
                <div class="size-7 rounded-full grid place-items-center shrink-0 text-xs font-semibold" :class="speechPrefs.voiceId === v.voice_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">{{ v.name.charAt(0) }}</div>
                <span class="text-sm font-medium">{{ v.name }}</span>
              </div>
              <Button size="icon-sm" variant="ghost" class="shrink-0" :disabled="testPlaying" @click.stop="testVoice(v.voice_id)">
                <Volume2 v-if="!testPlaying || speechPrefs.voiceId !== v.voice_id" class="size-3.5" />
                <Loader2 v-else class="size-3.5 animate-spin" />
              </Button>
            </button>
          </div>
          <p v-else class="text-sm text-muted-foreground text-center py-4">Add your <code class="text-xs bg-muted px-1 rounded">ELEVENLABS_API_KEY</code> to load voices.</p>
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium">Test phrase</p>
          <InputGroupTextarea v-model="testText" class="text-sm" />
          <Button variant="outline" size="sm" class="gap-2" :disabled="testPlaying || !speechPrefs.voiceId" @click="testVoice(speechPrefs.voiceId)">
            <Volume2 v-if="!testPlaying" class="size-4" /><Loader2 v-else class="size-4 animate-spin" />
            {{ testPlaying ? 'Playing…' : 'Play test' }}
          </Button>
        </div>
        <div v-if="speechPrefs.voiceName" class="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          Active voice: <span class="font-medium text-foreground">{{ speechPrefs.voiceName }}</span>
        </div>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Attachment preview (right sheet on desktop, bottom on touch) -->
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
</template>

<style scoped>
.audio-mode-enter-active { transition: opacity 0.25s ease; }
.audio-mode-leave-active { transition: opacity 0.18s ease; }
.audio-mode-enter-from,
.audio-mode-leave-to { opacity: 0; }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* Context picker overlay: fade the backdrop, slide the panel up */
.context-panel-enter-active { transition: opacity 0.2s ease; }
.context-panel-leave-active { transition: opacity 0.18s ease; }
.context-panel-enter-from,
.context-panel-leave-to { opacity: 0; }
.context-panel-enter-active .context-panel-sheet { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.context-panel-leave-active .context-panel-sheet { transition: transform 0.2s ease; }
.context-panel-enter-from .context-panel-sheet,
.context-panel-leave-to .context-panel-sheet { transform: translateY(100%); }

.history-panel-enter-active,
.history-panel-leave-active {
  transition: width 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
}
.history-panel-enter-from,
.history-panel-leave-to { width: 0 !important; opacity: 0; }
.history-panel-enter-to,
.history-panel-leave-from { width: 15rem; opacity: 1; }
</style>
