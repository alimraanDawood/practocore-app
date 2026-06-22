<script lang="ts" setup>
import {
  Paperclip, ArrowUp, Mic, MicOff, X, Check, Loader2, Sparkles, FileText,
  ChevronRight, ChevronDown, Wand2, Wrench, Scroll, BookOpen, Scale, Pencil,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  sendAiMessageStream, confirmAiProposal, improvePrompt,
  attachmentSha256, resolveAttachmentUrls, base64ToObjectUrl,
  type AiMessage, type AiContentBlock, type AiImageMediaType,
  type AiResponse, type AiStreamStep, type AiCitation, type ConvAttachment,
  type AiAttachmentMeta, type AiConversation,
} from '~/services/ai';
import { Sheet, SheetContent, SheetTitle } from '~/components/ui/sheet';
import type { SkillDetail } from '~/services/skills';
import { useSpeech } from '~/composables/useSpeech';
import ProposalCard from '~/components/shared/AI/ProposalCard.vue';
import MessageAttachments, { type AttachmentView } from '~/components/shared/AI/MessageAttachments.vue';
import DocumentPreview, { type PreviewDoc } from '~/components/shared/Vault/DocumentPreview.vue';

// Skill Studio chat (SKILLS_V2 §C2): the conversational skill builder, styled to
// match the main assistant (components/shared/AI/Chat.vue) — same InputGroup
// composer, same message rendering (CitedAnswer + step summary + attachment
// chips), audio transcription, and file attachments. It pins mode='skill_studio'
// so the backend uses the lean builder prompt + constrained tools. It deliberately
// drops the matter/deadline context picker — skill authoring needs no case context.

const emit = defineEmits<{ saved: []; changed: [id: string] }>();

const MODE = 'skill_studio';

interface StudioMsg {
  role: 'user' | 'assistant';
  content: string | AiContentBlock[];
  attachments?: ConvAttachment[];
  steps?: AiStreamStep[];
  durationMs?: number;
  stepsOpen?: boolean;
  citations?: AiCitation[];
  proposal?: AiResponse; // assistant turn awaiting approval
}

const messages = ref<StudioMsg[]>([]);
const inputText = ref('');
const loading = ref(false);
const confirming = ref(false);
const activeSteps = ref<AiStreamStep[]>([]);
const workStartedAt = ref(0);
const conversationId = ref('');
const scroller = ref<HTMLElement | null>(null);
// Set when the studio was opened to refine an existing skill, so a banner shows
// what's being edited and the seeded turn keeps the same skill id.
const editingSkill = ref<{ name: string; title: string } | null>(null);

const empty = computed(() => messages.value.length === 0);

const suggestions = [
  'Create a skill for reviewing our standard tenancy agreements.',
  'Teach you how we draft a demand letter for unpaid invoices.',
  'Build a checklist skill for filing a Commercial Court application.',
];

// Transcript sent to the backend: text/multimodal turns only (proposal turns are
// carried via the proposal's own pendingMessages on confirm).
const apiMessages = computed<AiMessage[]>(() =>
  messages.value.filter(m => !m.proposal).map(m => ({ role: m.role, content: m.content })),
);

const canSend = computed(() =>
  !loading.value && (inputText.value.trim().length > 0 || attachments.value.length > 0),
);

async function scrollDown() {
  await nextTick();
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' });
}

// ── Attachments (mirrors Chat.vue) ────────────────────────────────────────────
interface Attachment {
  id: string; name: string; mime: string; size: number;
  kind: 'binary' | 'text'; base64?: string; dataUrl?: string; text?: string;
}
const attachments = ref<Attachment[]>([]);
const sentAttachmentsMeta = ref<AiAttachmentMeta[]>([]);
const attachmentUrls = ref<Map<string, string>>(new Map());
const fileInput = ref<HTMLInputElement | null>(null);

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
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
      resolve({ base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, dataUrl });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const ACCEPTED_IMAGE_TYPES: AiImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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
  for (const file of Array.from(files)) {
    if (!isAcceptedFile(file)) {
      toast('Unsupported file', { description: `${file.name} — PDFs, images, and text/Markdown only.` });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast('File too large', { description: `${file.name} is ${formatBytes(file.size)}. Max ${formatBytes(MAX_FILE_BYTES)}.` });
      continue;
    }
    if (totalAttachmentBytes.value + file.size > MAX_TOTAL_BYTES) {
      toast('Attachment limit reached', { description: `Total must stay under ${formatBytes(MAX_TOTAL_BYTES)}.` });
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
  if (!input.files?.length) return;
  await addFiles(input.files);
  input.value = '';
}
function removeAttachment(id: string) { attachments.value = attachments.value.filter(a => a.id !== id); }
function openFilePicker() { fileInput.value?.click(); }

// ── Attachment chips + preview (mirrors Chat.vue) ─────────────────────────────
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
function stripAttachmentPlaceholders(text: string): string {
  return text.replace(/\[(?:image|file|PDF|document)(?::[^\]]*)?\]/g, '').replace(/\s{2,}/g, ' ').trim();
}
function messageChips(msg: StudioMsg): AttachmentView[] {
  return (msg.attachments ?? []).map(a => ({
    id: a.sha256, name: a.name ?? '', mime: a.mime ?? '', kind: a.kind ?? 'binary',
    size: a.size, url: attachmentUrls.value.get(a.sha256),
  }));
}
const previewTarget = ref<AttachmentView | null>(null);
const previewOpen = computed({
  get: () => !!previewTarget.value,
  set: (v) => { if (!v) previewTarget.value = null; },
});
const previewDoc = computed<PreviewDoc | null>(() => previewTarget.value
  ? { id: previewTarget.value.id, filename: previewTarget.value.name, file: previewTarget.value.name, mime: previewTarget.value.mime }
  : null);
function openPreview(att: AttachmentView) { previewTarget.value = att; }
const resolvePreviewUrl = () => Promise.resolve(previewTarget.value?.url ?? '');

// ── Audio transcription (dictate into the composer) ───────────────────────────
const speech = useSpeech();
let micBase = '';
function toggleMic() {
  if (speech.isListening.value) { speech.stopListening(); return; }
  micBase = inputText.value.trim() ? inputText.value.trim() + ' ' : '';
  speech.startListening();
}
watch(speech.transcript, (t) => {
  if (speech.isListening.value || speech.isTranscribing.value) {
    inputText.value = (micBase + (t || '')).trim();
  }
});

// ── Enhance prompt ────────────────────────────────────────────────────────────
const enhancing = ref(false);
const canEnhance = computed(() => inputText.value.trim().length > 0 && !enhancing.value && !loading.value);
async function enhancePrompt() {
  const original = inputText.value.trim();
  if (!original) return;
  enhancing.value = true;
  try {
    const result = await improvePrompt(original);
    if (result.improved) {
      inputText.value = result.improved;
      toast('Prompt improved', { action: { label: 'Undo', onClick: () => { inputText.value = original; } } });
    } else if (result.error) {
      toast('Could not improve', { description: result.error });
    }
  } finally {
    enhancing.value = false;
  }
}

// ── Send ──────────────────────────────────────────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

async function send(seed?: string) {
  const text = (seed ?? inputText.value).trim();
  const hasAttachments = attachments.value.length > 0;
  if ((!text && !hasAttachments) || loading.value) return;

  let userContent: string | AiContentBlock[];
  const userAttachments: ConvAttachment[] = [];
  if (hasAttachments) {
    const blocks: AiContentBlock[] = [];
    for (const a of attachments.value) {
      let data: string;
      if (a.kind === 'text') {
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
      const url = a.kind === 'text'
        ? URL.createObjectURL(new Blob([a.text ?? ''], { type: a.mime || 'text/plain' }))
        : base64ToObjectUrl(a.base64 as string, a.mime);
      if (url && sha256) attachmentUrls.value.set(sha256, url);
    }
    blocks.push({ type: 'text', text: text || 'Please use the attached file to build the skill.' });
    userContent = blocks;
  } else {
    userContent = text;
  }

  messages.value.push({ role: 'user', content: userContent, attachments: userAttachments.length ? userAttachments : undefined });
  inputText.value = '';
  if (hasAttachments) attachments.value = [];
  loading.value = true;
  activeSteps.value = [];
  workStartedAt.value = Date.now();
  await scrollDown();

  try {
    const res = await sendAiMessageStream(apiMessages.value, undefined, conversationId.value || undefined, {
      mode: MODE,
      attachmentsMeta: sentAttachmentsMeta.value,
      onStep: (s) => { activeSteps.value = [...activeSteps.value, s]; scrollDown(); },
    });
    const elapsedMs = Date.now() - workStartedAt.value;
    const turnSteps = activeSteps.value.filter(s => s.tool);
    activeSteps.value = [];
    if (res.conversationId) { conversationId.value = res.conversationId; emit('changed', res.conversationId); }
    handleResponse(res, turnSteps, elapsedMs);
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Something went wrong: ${e?.message || e}` });
  } finally {
    loading.value = false;
    await scrollDown();
  }
}

function handleResponse(res: AiResponse, steps: AiStreamStep[] = [], durationMs = 0) {
  if (res.type === 'error') {
    messages.value.push({ role: 'assistant', content: res.error || 'The assistant could not respond.' });
    return;
  }
  if (res.type === 'proposal') {
    messages.value.push({ role: 'assistant', content: res.description || '', proposal: res });
    return;
  }
  messages.value.push({
    role: 'assistant',
    content: res.content || '',
    steps: steps.length ? steps : undefined,
    durationMs: steps.length ? durationMs : undefined,
    stepsOpen: false,
    citations: res.citations?.length ? res.citations : undefined,
  });
}

async function decide(msg: StudioMsg, approved: boolean) {
  if (!msg.proposal || confirming.value) return;
  confirming.value = true;
  try {
    const res = await confirmAiProposal(
      msg.proposal, approved, undefined, conversationId.value || undefined, undefined, false, undefined, MODE,
    );
    if (res.conversationId) { conversationId.value = res.conversationId; emit('changed', res.conversationId); }
    msg.proposal = undefined;
    msg.content = approved ? '' : 'Discarded.';
    handleResponse(res);
    if (approved) emit('saved');
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Could not complete that: ${e?.message || e}` });
  } finally {
    confirming.value = false;
    await scrollDown();
  }
}

// ── Step summary helpers (mirrors Chat.vue look) ──────────────────────────────
function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
const STEP_ICONS: Record<string, any> = {
  list_skills: Scroll, load_skill: Scroll, propose_skill: Wand2,
  list_legal_knowledge: BookOpen, get_procedure_overview: BookOpen,
  search_case_law: Scale, get_authority: Scale, find_treatment: Scale,
};
function stepIcon(tool: string) { return STEP_ICONS[tool] || Wrench; }

// ── Lifecycle / resume ────────────────────────────────────────────────────────
function reset() {
  messages.value = [];
  inputText.value = '';
  conversationId.value = '';
  attachments.value = [];
  sentAttachmentsMeta.value = [];
  attachmentUrls.value = new Map();
  activeSteps.value = [];
  editingSkill.value = null;
}

// Open the studio to refine an existing skill: seed the conversation with the
// skill's current definition and an instruction to keep the same id (so
// propose_skill UPDATES it rather than creating a copy), then send so the
// assistant reads it and asks what to change.
function beginEdit(skill: SkillDetail) {
  reset();
  editingSkill.value = { name: skill.name, title: skill.title };
  send(buildEditSeed(skill));
}

function buildEditSeed(s: SkillDetail): string {
  const lines = [
    `Let's refine an existing firm skill. Keep the same id \`${s.name}\` when you propose changes so it UPDATES this skill instead of creating a new one.`,
    '',
    `Title: ${s.title}`,
    `Purpose: ${s.purpose}`,
  ];
  if (s.triggers) lines.push(`Used when: ${s.triggers}`);
  if (s.court_scope) lines.push(`Court scope: ${s.court_scope}`);
  if (s.tool_bindings?.length) lines.push(`Tools it may drive: ${s.tool_bindings.join(', ')}`);
  lines.push('', 'Current instructions:', '', s.instructions || '(none yet)', '', 'Ask me what I would like to change.');
  return lines.join('\n');
}
async function load(conv: AiConversation) {
  reset();
  conversationId.value = conv.id;
  messages.value = (conv.messages || [])
    .filter(m => (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      steps: m.steps?.length ? m.steps : undefined,
      durationMs: m.durationMs,
      stepsOpen: false,
      citations: m.citations?.length ? m.citations : undefined,
      attachments: m.attachments,
    }));
  try {
    attachmentUrls.value = await resolveAttachmentUrls(conv.id);
  } catch { /* chips just won't preview */ }
  await scrollDown();
}

defineExpose({ reset, load, beginEdit, currentId: () => conversationId.value });
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Editing banner -->
    <div v-if="editingSkill" class="flex items-center gap-2 text-xs rounded-lg border bg-muted/40 px-3 py-2 mb-2">
      <Pencil class="size-3.5 text-muted-foreground shrink-0" />
      <span class="text-muted-foreground">Refining</span>
      <span class="font-medium truncate">{{ editingSkill.title }}</span>
      <code class="text-[11px] text-muted-foreground">{{ editingSkill.name }}</code>
    </div>

    <!-- Transcript -->
    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto px-1 py-3 flex flex-col gap-4">
      <!-- Empty state -->
      <div v-if="empty" class="m-auto max-w-md text-center flex flex-col items-center gap-3 px-4">
        <div class="size-11 rounded-xl grid place-items-center bg-primary/10 text-primary">
          <Wand2 class="size-5" />
        </div>
        <p class="font-semibold">Build a firm skill</p>
        <p class="text-sm text-muted-foreground">
          Describe a task your firm does often. I'll interview you, then draft a reusable skill the
          assistant can follow — saved as a private draft for your firm to review.
        </p>
        <div class="flex flex-col gap-2 w-full mt-1">
          <button
            v-for="s in suggestions" :key="s"
            class="text-left text-sm rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
            @click="send(s)"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <!-- Messages -->
      <template v-for="(m, i) in messages" :key="i">
        <!-- User -->
        <div v-if="m.role === 'user'" class="flex justify-end">
          <div class="flex flex-col items-end gap-1 max-w-[80%]">
            <MessageAttachments v-if="messageChips(m).length" :attachments="messageChips(m)" align="end" @preview="openPreview" />
            <div
              v-if="stripAttachmentPlaceholders(messageText(m.content))"
              class="bg-muted text-muted-foreground border rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
            >
              {{ stripAttachmentPlaceholders(messageText(m.content)) }}
            </div>
          </div>
        </div>

        <!-- Assistant -->
        <div v-else class="flex items-start gap-2 group/msg">
          <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
            <Sparkles class="size-3" />
          </div>
          <div class="flex flex-col gap-0.5 max-w-[85%] min-w-0">
            <!-- Step summary -->
            <div v-if="m.steps && m.steps.length" class="mb-1">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                @click="m.stepsOpen = !m.stepsOpen"
              >
                <Check class="size-3 text-emerald-500" />
                <span>Worked for {{ formatDuration(m.durationMs ?? 0) }}</span>
                <component :is="m.stepsOpen ? ChevronDown : ChevronRight" class="size-3" />
              </button>
              <ul v-if="m.stepsOpen" class="mt-1.5 ml-1 flex flex-col gap-1 border-l border-border pl-3">
                <li v-for="step in m.steps" :key="step.id" class="flex items-center gap-2 text-xs text-muted-foreground">
                  <component :is="stepIcon(step.tool)" class="size-3 shrink-0 opacity-70" />
                  <span class="truncate">{{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{ step.detail }}</span></span>
                </li>
              </ul>
            </div>

            <div v-if="m.content" class="bg-background border text-foreground rounded-lg px-3 py-2 text-sm">
              <SharedAICitationsCitedAnswer :content="messageText(m.content)" :citations="m.citations" />
            </div>

            <ProposalCard
              v-if="m.proposal"
              :proposal="m.proposal"
              variant="panel"
              :loading="confirming"
              class="mt-1"
              @approve="decide(m, true)"
              @dismiss="decide(m, false)"
            />
          </div>
        </div>
      </template>

      <!-- Live "Working…" panel -->
      <div v-if="loading" class="flex items-start gap-2">
        <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
          <Sparkles class="size-3" />
        </div>
        <div class="flex flex-col gap-1 pt-1">
          <div v-for="(s, idx) in activeSteps" :key="s.id" class="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 v-if="idx === activeSteps.length - 1" class="size-3 animate-spin shrink-0" />
            <Check v-else class="size-3 text-emerald-500 shrink-0" />
            <span class="truncate">{{ s.label }}<span v-if="s.detail" class="opacity-60"> · {{ s.detail }}</span></span>
          </div>
          <div v-if="!activeSteps.length" class="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 class="size-3 animate-spin" /> Thinking…
          </div>
        </div>
      </div>
    </div>

    <!-- Composer (mirrors Chat.vue InputGroup, no context picker) -->
    <div class="pt-2 pb-1">
      <!-- Attachment chips -->
      <div v-if="attachments.length" class="flex flex-wrap gap-2 mb-2">
        <div
          v-for="att in attachments" :key="att.id"
          class="flex items-center gap-1.5 rounded-md border bg-background pr-1 pl-1 py-1 text-xs"
        >
          <img v-if="att.mime.startsWith('image/')" :src="att.dataUrl" :alt="att.name" class="size-8 rounded object-cover shrink-0" />
          <FileText v-else class="size-4 text-muted-foreground shrink-0" />
          <span class="max-w-[140px] truncate font-medium">{{ att.name }}</span>
          <span class="text-muted-foreground">{{ formatBytes(att.size) }}</span>
          <button class="ml-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0" :aria-label="`Remove ${att.name}`" @click="removeAttachment(att.id)">
            <X class="size-3" />
          </button>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,text/markdown,text/plain,text/*,.md,.markdown,.txt,.text,.csv,.json,.log"
        class="hidden"
        @change="onFilesChosen"
      />

      <InputGroup>
        <InputGroupTextarea
          v-model="inputText"
          placeholder="Describe the task, or answer the question…"
          @keydown="handleKeydown"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton variant="outline" size="icon-sm" title="Attach a PDF, image or text file" @click="openFilePicker">
            <Paperclip class="size-4" />
            <span class="sr-only">Attach a file</span>
          </InputGroupButton>
          <InputGroupButton
            variant="outline" size="sm"
            :disabled="!canEnhance"
            title="Enhance prompt — rewrite it for sharper results"
            @click="enhancePrompt"
          >
            <Loader2 v-if="enhancing" class="size-4 animate-spin" />
            <Sparkles v-else class="size-4" />
            {{ enhancing ? 'Enhancing…' : 'Enhance' }}
          </InputGroupButton>
          <Separator orientation="vertical" class="!h-4 ml-auto" />
          <InputGroupButton
            variant="default" class="rounded-full" size="icon-sm"
            :disabled="!canSend"
            @click="send()"
          >
            <ArrowUp class="size-4" />
            <span class="sr-only">Send</span>
          </InputGroupButton>
          <!-- Mic → dictation into the composer -->
          <InputGroupButton
            :variant="speech.isListening.value ? 'destructive' : 'default'"
            class="rounded-full" size="icon-sm"
            :title="speech.isListening.value ? 'Stop dictation' : 'Dictate'"
            @click="toggleMic"
          >
            <Loader2 v-if="speech.isTranscribing.value" class="size-4 animate-spin" />
            <MicOff v-else-if="speech.isListening.value" class="size-4" />
            <Mic v-else class="size-4" />
            <span class="sr-only">Dictate</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p class="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
        <Sparkles class="size-3" /> Skills save as drafts — review and activate them before the assistant uses them.
      </p>
    </div>

    <!-- Attachment preview (reuses the vault DocumentPreview viewer) -->
    <Sheet v-model:open="previewOpen">
      <SheetContent side="right" hide-x class="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetTitle class="sr-only">Attachment preview</SheetTitle>
        <DocumentPreview
          v-if="previewDoc"
          :doc="previewDoc"
          :resolve-url="resolvePreviewUrl"
          class="min-h-0 flex-1"
          @close="previewOpen = false"
        />
      </SheetContent>
    </Sheet>
  </div>
</template>
