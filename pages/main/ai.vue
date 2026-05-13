<script lang="ts" setup>
import {
  Sparkles, Mic, MicOff, ArrowUpIcon, X, Check, Loader2,
  Plus, Trash2, MessageSquare, AtSign, Building2, Clock, User,
  Volume2, VolumeX, ChevronLeft, Zap, Menu, Settings,
} from 'lucide-vue-next';
import type { VoiceEntry } from '~/composables/useSpeech';
import { marked } from 'marked';
import { getSignedInUser } from '~/services/auth';
import {
  sendAiMessage, confirmAiProposal,
  listConversations, getConversation, deleteConversation,
  type AiMessage, type AiResponse, type AiContext, type AiConversationSummary,
  type ConvDisplayMessage,
} from '~/services/ai';
import { getMatters, getAllDeadlines } from '~/services/matters';
import { getOrganisationUsers } from '~/services/admin';

definePageMeta({ layout: 'blank' });

marked.use({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

// ── Speech ────────────────────────────────────────────────────────────────────
const {
  isListening, isTranscribing, transcript, sttSupported, audioLevel, micError,
  startListening, stopListening,
  isSpeaking, ttsSupported, speak, stopSpeaking,
  prefs: speechPrefs, savePrefs,
} = useSpeech();

const autoRead = ref(true);

// ── Chat state ────────────────────────────────────────────────────────────────
type ToolEvent = { role: 'tool-event'; content: string; status: 'approved' | 'rejected' };
type ChatMessage = AiMessage | ToolEvent;

const messages = ref<ChatMessage[]>([]);
const apiMessages = computed(() =>
  messages.value.filter((m): m is AiMessage => m.role !== 'tool-event'),
);
const convMessages = computed<ConvDisplayMessage[]>(() =>
  messages.value.map(m =>
    m.role === 'tool-event'
      ? { role: `tool-event:${m.status}`, content: m.content }
      : { role: m.role, content: m.content },
  ),
);

const conversationId = ref('');
const pendingProposal = ref<AiResponse | null>(null);
const inputText = ref('');
const loading = ref(false);
const proposalLoading = ref(false);
const messagesEnd = ref<HTMLElement | null>(null);

const firstName = computed(() => getSignedInUser()?.name?.split(' ').at(0) || 'there');

// ── Voice state machine ───────────────────────────────────────────────────────
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
const voiceState = ref<VoiceState>('idle');

// Recording stopped → enter thinking (transcribing in progress)
watch(isListening, (listening) => {
  if (!listening && voiceState.value === 'listening') {
    voiceState.value = 'thinking';
  }
});

// Transcription done → send or fall back to idle
watch(isTranscribing, (transcribing) => {
  if (!transcribing) {
    if (transcript.value.trim()) {
      sendMessage(transcript.value.trim());
    } else {
      voiceState.value = 'idle';
    }
  }
});

watch(isSpeaking, (speaking) => {
  if (speaking) voiceState.value = 'speaking';
  else if (voiceState.value === 'speaking') voiceState.value = 'idle';
});

watch(micError, (err) => {
  if (err) voiceState.value = 'idle';
});

// ── Voice settings panel ──────────────────────────────────────────────────────
const voiceSettingsOpen = ref(false);
const voices = ref<VoiceEntry[]>([]);
const voicesLoading = ref(false);
const testText = ref('The deadline for filing submissions is March 15th. Please review the matter urgently.');
const testPlaying = ref(false);
const sttTestTranscript = ref('');
const sttTestRecording = ref(false);

watch(voiceSettingsOpen, async (open) => {
  if (!open || voices.value.length > 0) return;
  voicesLoading.value = true;
  try {
    const { pb, SERVER_URL } = await import('~/lib/pocketbase');
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/voices`, {
      headers: { 'Authorization': pb.authStore.token },
    });
    if (res.ok) {
      const data = await res.json();
      voices.value = data.voices ?? [];
    }
  } catch {}
  voicesLoading.value = false;
});

async function testVoice(voiceId: string, voiceName: string) {
  testPlaying.value = true;
  const prevVoiceId = speechPrefs.value.voiceId;
  speechPrefs.value.voiceId = voiceId;
  await speak(testText.value);
  speechPrefs.value.voiceId = prevVoiceId;
  testPlaying.value = false;
}

function selectVoice(voice: VoiceEntry) {
  speechPrefs.value.voiceId = voice.voice_id;
  speechPrefs.value.voiceName = voice.name;
  savePrefs();
}

function toggleMic() {
  if (isListening.value) {
    stopListening();
  } else {
    stopSpeaking();
    voiceState.value = 'listening';
    startListening();
  }
}

// ── History ───────────────────────────────────────────────────────────────────
const sidebarOpen = ref(false);
const historyLoading = ref(false);
const conversations = ref<AiConversationSummary[]>([]);
const historyLoaded = ref(false);

async function refreshHistory() {
  historyLoading.value = true;
  try {
    const page = await listConversations(1, 40);
    conversations.value = page?.items ?? [];
    historyLoaded.value = true;
  } finally {
    historyLoading.value = false;
  }
}

async function loadConversation(id: string) {
  if (conversationId.value === id) { sidebarOpen.value = false; return; }
  const conv = await getConversation(id);
  if (!conv) return;
  messages.value = (conv.messages ?? []).map((m): ChatMessage => {
    if (m.role.startsWith('tool-event:')) {
      const status = m.role.slice('tool-event:'.length) as 'approved' | 'rejected';
      return { role: 'tool-event', content: m.content, status };
    }
    return m as AiMessage;
  });
  conversationId.value = conv.id;
  pendingProposal.value = null;
  sidebarOpen.value = false;
  scrollToBottom();
}

function newChat() {
  messages.value = [];
  conversationId.value = '';
  pendingProposal.value = null;
  inputText.value = '';
  voiceState.value = 'idle';
  stopSpeaking();
}

async function removeConversation(id: string) {
  const ok = await deleteConversation(id);
  if (!ok) return;
  conversations.value = conversations.value.filter(c => c.id !== id);
  if (conversationId.value === id) newChat();
}

const groupedConversations = computed(() => {
  const groups: { label: string; items: AiConversationSummary[] }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7);
  const todayG: AiConversationSummary[] = [], yestG: AiConversationSummary[] = [];
  const weekG: AiConversationSummary[] = [], olderG: AiConversationSummary[] = [];
  for (const c of conversations.value) {
    const d = new Date(c.updated); d.setHours(0, 0, 0, 0);
    if (d >= today) todayG.push(c);
    else if (d >= yesterday) yestG.push(c);
    else if (d >= lastWeek) weekG.push(c);
    else olderG.push(c);
  }
  if (todayG.length) groups.push({ label: 'Today', items: todayG });
  if (yestG.length) groups.push({ label: 'Yesterday', items: yestG });
  if (weekG.length) groups.push({ label: 'This week', items: weekG });
  if (olderG.length) groups.push({ label: 'Older', items: olderG });
  return groups;
});

// ── Context ───────────────────────────────────────────────────────────────────
type ContextType = 'matter' | 'deadline' | 'user';
interface ContextItem { type: ContextType; id: string; label: string; sublabel?: string }

const selectedItems = ref<ContextItem[]>([]);
const contextIcons: Record<ContextType, any> = { matter: Building2, deadline: Clock, user: User };

function buildContext(): AiContext | undefined {
  if (!selectedItems.value.length) return undefined;
  return {
    matterIds:   selectedItems.value.filter(i => i.type === 'matter').map(i => i.id),
    deadlineIds: selectedItems.value.filter(i => i.type === 'deadline').map(i => i.id),
    userIds:     selectedItems.value.filter(i => i.type === 'user').map(i => i.id),
  };
}

function toggleItem(item: ContextItem) {
  const idx = selectedItems.value.findIndex(i => i.id === item.id);
  if (idx >= 0) selectedItems.value.splice(idx, 1);
  else selectedItems.value.push(item);
}

function isSelected(id: string) {
  return selectedItems.value.some(i => i.id === id);
}

const contextDrawerOpen = ref(false);
const contextTab = ref<ContextType>('matter');
const contextSearch = ref('');
const mattersList = ref<{ id: string; name: string; caseNumber: string }[]>([]);
const deadlinesList = ref<{ id: string; name: string; matterName: string }[]>([]);
const usersList = ref<{ id: string; name: string; role: string }[]>([]);
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
    mattersList.value = (mattersRes.items ?? []).map((m: any) => ({ id: m.id, name: m.name, caseNumber: m.caseNumber }));
    deadlinesList.value = (deadlinesRes ?? []).map((d: any) => ({ id: d.id, name: d.name, matterName: d.expand?.matter?.name ?? '' }));
    usersList.value = (usersRes.items ?? []).map((u: any) => ({ id: u.id, name: u.name, role: u.organisationRole ?? u.role ?? '' }));
  } finally {
    contextLoading.value = false;
  }
});

const q = computed(() => contextSearch.value.toLowerCase());
const filteredMatters = computed(() =>
  q.value ? mattersList.value.filter(m => m.name.toLowerCase().includes(q.value) || m.caseNumber?.toLowerCase().includes(q.value)) : mattersList.value,
);
const filteredDeadlines = computed(() =>
  q.value ? deadlinesList.value.filter(d => d.name.toLowerCase().includes(q.value) || d.matterName.toLowerCase().includes(q.value)) : deadlinesList.value,
);
const filteredUsers = computed(() =>
  q.value ? usersList.value.filter(u => u.name.toLowerCase().includes(q.value)) : usersList.value,
);

// ── Messaging ─────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }));
}

async function sendMessage(text: string) {
  if (!text.trim() || loading.value) return;
  stopSpeaking();
  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  pendingProposal.value = null;
  loading.value = true;
  voiceState.value = 'thinking';
  scrollToBottom();

  const response = await sendAiMessage(apiMessages.value, buildContext(), conversationId.value || undefined, true);
  loading.value = false;

  if (response.type === 'text') {
    messages.value.push({ role: 'assistant', content: response.content ?? '' });
    if (response.conversationId) {
      const isNew = !conversationId.value;
      conversationId.value = response.conversationId;
      if (isNew && historyLoaded.value) await refreshHistory();
      else if (!isNew && historyLoaded.value) {
        const idx = conversations.value.findIndex(c => c.id === response.conversationId);
        if (idx >= 0) conversations.value[idx]!.updated = new Date().toISOString();
      }
    }
    if (autoRead.value && ttsSupported.value) speak(response.content ?? '');
    else voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    messages.value.push({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
    voiceState.value = 'idle';
  }
  scrollToBottom();
}

function sendTextInput() {
  const text = inputText.value.trim();
  if (!text || loading.value) return;
  sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextInput(); }
}

function dismissProposal() {
  if (pendingProposal.value) {
    messages.value.push({ role: 'tool-event', content: formatToolName(pendingProposal.value.tool ?? ''), status: 'rejected' });
  }
  pendingProposal.value = null;
}

async function approveProposal() {
  if (!pendingProposal.value || proposalLoading.value) return;
  proposalLoading.value = true;
  const proposal = pendingProposal.value;
  pendingProposal.value = null;
  messages.value.push({ role: 'tool-event', content: formatToolName(proposal.tool ?? ''), status: 'approved' });
  loading.value = true;
  voiceState.value = 'thinking';
  scrollToBottom();

  const response = await confirmAiProposal(
    proposal, true, buildContext(),
    conversationId.value || undefined,
    convMessages.value,
    true,
  );
  loading.value = false;
  proposalLoading.value = false;

  if (response.type === 'text') {
    messages.value.push({ role: 'assistant', content: response.content ?? '' });
    if (response.conversationId) {
      conversationId.value = response.conversationId;
      if (historyLoaded.value) refreshHistory();
    }
    if (autoRead.value && ttsSupported.value) speak(response.content ?? '');
    else voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    messages.value.push({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
    voiceState.value = 'idle';
  }
  scrollToBottom();
}

function formatToolName(tool: string): string {
  return tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function proposalSummaryLines(input: Record<string, any> | undefined): string[] {
  if (!input) return [];
  const labels: Record<string, string> = { new_date: 'New date', reason: 'Reason', force: 'Force', assignee_ids: 'Assignees' };
  return Object.entries(input)
    .filter(([k]) => k !== 'deadline_id' && k !== 'matter_id')
    .map(([k, v]) => {
      const label = labels[k] ?? k.replace(/_/g, ' ');
      const value = Array.isArray(v) ? `${v.length} user(s)` : String(v);
      return `${label}: ${value}`;
    });
}

const SUGGESTIONS = [
  'What deadlines are due this week?',
  'Search for recent matters',
  'Adjourn an upcoming deadline',
  'Who is assigned to a matter?',
];

// ── Init ──────────────────────────────────────────────────────────────────────
const route = useRoute();

onMounted(async () => {
  refreshHistory();

  const convId = route.query.conversation as string | undefined;
  if (convId) await loadConversation(convId);

  const matterId = route.query.matter as string | undefined;
  if (matterId) selectedItems.value.push({ type: 'matter', id: matterId, label: 'Loading…' });
});
</script>

<template>
  <div class="flex h-dvh bg-background overflow-hidden">

    <!-- Mobile sidebar overlay -->
    <Transition name="sidebar-overlay">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-black/50 lg:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-background border-r transition-transform duration-250 ease-in-out lg:static lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center gap-2 px-4 py-4 border-b shrink-0">
        <div class="size-7 bg-primary text-primary-foreground grid place-items-center rounded-full">
          <Sparkles class="size-3.5" />
        </div>
        <span class="font-semibold">PractoAI</span>
        <Button size="icon-sm" variant="ghost" class="ml-auto lg:hidden" @click="sidebarOpen = false">
          <X class="size-4" />
        </Button>
      </div>

      <div class="px-3 py-3 shrink-0">
        <Button variant="outline" class="w-full gap-2" @click="newChat">
          <Plus class="size-4" />
          New Conversation
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="historyLoading" class="flex justify-center py-8">
          <Loader2 class="size-4 animate-spin text-muted-foreground" />
        </div>

        <template v-else-if="groupedConversations.length > 0">
          <div v-for="group in groupedConversations" :key="group.label" class="mb-2">
            <p class="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {{ group.label }}
            </p>
            <button
              v-for="conv in group.items"
              :key="conv.id"
              class="group w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-2.5"
              :class="conversationId === conv.id ? 'bg-accent' : ''"
              @click="loadConversation(conv.id)"
            >
              <MessageSquare class="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span class="flex-1 text-sm truncate leading-snug">{{ conv.title }}</span>
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                @click.stop="removeConversation(conv.id)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </button>
          </div>
        </template>

        <p v-else class="px-3 py-8 text-sm text-muted-foreground text-center">
          No conversations yet.
        </p>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex flex-col flex-1 min-w-0">

      <!-- Header -->
      <header class="flex items-center gap-2 px-4 h-14 border-b shrink-0">
        <Button size="icon-sm" variant="ghost" class="lg:hidden" @click="sidebarOpen = true">
          <Menu class="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" @click="navigateTo(-1 as any)">
          <ChevronLeft class="size-4" />
        </Button>
        <div class="flex items-center gap-2">
          <div
            class="size-7 bg-primary text-primary-foreground grid place-items-center rounded-full"
            :class="isSpeaking ? 'animate-pulse' : ''"
          >
            <Sparkles class="size-3.5" />
          </div>
          <span class="font-semibold text-sm">PractoAI</span>
          <span v-if="voiceState === 'listening'" class="text-xs text-primary animate-pulse">Listening…</span>
          <span v-else-if="voiceState === 'thinking'" class="text-xs text-muted-foreground">Thinking…</span>
          <span v-else-if="voiceState === 'speaking'" class="text-xs text-primary animate-pulse">Speaking…</span>
        </div>
        <div class="ml-auto flex items-center gap-1">
          <Button
            v-if="ttsSupported"
            size="icon-sm"
            variant="ghost"
            :class="autoRead ? 'text-primary' : 'text-muted-foreground'"
            :title="autoRead ? 'Auto-read on — click to turn off' : 'Auto-read off — click to turn on'"
            @click="autoRead = !autoRead; if (!autoRead) stopSpeaking()"
          >
            <Volume2 v-if="autoRead" class="size-4" />
            <VolumeX v-else class="size-4" />
          </Button>
          <Button
            size="icon-sm"
            :variant="isListening ? 'destructive' : 'ghost'"
            :class="isListening ? 'animate-pulse' : 'text-muted-foreground'"
            :title="isListening ? 'Stop recording' : 'Start voice input'"
            @click="toggleMic"
          >
            <MicOff v-if="isListening" class="size-4" />
            <Mic v-else class="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" @click="newChat">
            <Plus class="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" title="Voice settings" @click="voiceSettingsOpen = true">
            <Settings class="size-4" />
          </Button>
        </div>
      </header>

      <!-- Mic error banner -->
      <Transition name="proposal">
        <div v-if="micError" class="shrink-0 px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <MicOff class="size-4 shrink-0" />
          <span class="flex-1">{{ micError }}</span>
          <button class="shrink-0 hover:opacity-70" @click="micError = ''"><X class="size-4" /></button>
        </div>
      </Transition>

      <!-- Tool proposal — pinned under header -->
      <Transition name="proposal">
        <div v-if="pendingProposal" class="shrink-0 px-4 py-3 border-b bg-muted/30">
          <div class="max-w-2xl mx-auto border rounded-xl p-4 bg-background shadow-sm">
            <div class="flex items-center gap-3 mb-3">
              <div class="size-9 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                <Zap class="size-4" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wide font-medium">Action Required</p>
                <p class="font-semibold text-base leading-tight">{{ formatToolName(pendingProposal.tool ?? '') }}</p>
              </div>
            </div>
            <p class="text-sm text-muted-foreground mb-3">{{ pendingProposal.description }}</p>
            <ul
              v-if="proposalSummaryLines(pendingProposal.input).length"
              class="text-sm text-foreground flex flex-col gap-1 mb-4 pl-3 border-l-2 border-primary/40"
            >
              <li v-for="line in proposalSummaryLines(pendingProposal.input)" :key="line">{{ line }}</li>
            </ul>
            <div class="flex gap-3">
              <Button class="flex-1 h-12 text-base gap-2" :disabled="proposalLoading" @click="approveProposal">
                <Loader2 v-if="proposalLoading" class="size-4 animate-spin" />
                <Check v-else class="size-4" />
                Approve
              </Button>
              <Button variant="outline" class="flex-1 h-12 text-base gap-2" :disabled="proposalLoading" @click="dismissProposal">
                <X class="size-4" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Messages / empty state -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4 min-h-full">

          <template v-if="messages.length === 0 && !loading">
            <div class="flex flex-col items-center justify-center flex-1 gap-8 py-12 text-center">
              <div>
                <div class="size-16 bg-primary text-primary-foreground grid place-items-center rounded-full mx-auto mb-4">
                  <Sparkles class="size-7" />
                </div>
                <h1 class="text-2xl font-semibold">Hi {{ firstName }}!</h1>
                <p class="text-muted-foreground mt-1">How can I help you today?</p>
              </div>

              <!-- Suggested prompts grid -->
              <div class="grid grid-cols-2 gap-2 w-full max-w-md">
                <Button
                  v-for="s in SUGGESTIONS"
                  :key="s"
                  variant="outline"
                  class="h-auto py-3 px-4 text-left text-sm leading-snug whitespace-normal justify-start"
                  @click="sendMessage(s)"
                >
                  {{ s }}
                </Button>
              </div>

              <!-- Big mic CTA -->
              <div class="flex flex-col items-center gap-3 mt-2">
                <p class="text-sm text-muted-foreground">— or tap to speak —</p>
                <Button
                  size="icon"
                  class="size-20 rounded-full shadow-lg [&_svg]:size-8"
                  :class="isListening ? 'animate-pulse ring-4 ring-primary/30' : ''"
                  @click="toggleMic"
                >
                  <Mic />
                </Button>
              </div>
            </div>
          </template>

          <!-- Messages -->
          <template v-for="(msg, i) in messages" :key="i">
            <div v-if="msg.role === 'tool-event'" class="flex justify-center">
              <span
                class="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border"
                :class="msg.status === 'approved' ? 'bg-muted text-muted-foreground' : 'bg-muted/40 text-muted-foreground'"
              >
                <Check v-if="msg.status === 'approved'" class="size-3" />
                <X v-else class="size-3" />
                {{ msg.status === 'approved' ? 'Approved' : 'Dismissed' }}: {{ msg.content }}
              </span>
            </div>
            <div v-else-if="msg.role === 'user'" class="flex justify-end">
              <div class="max-w-[80%] bg-muted text-foreground rounded-2xl px-4 py-2.5 text-base">
                {{ msg.content }}
              </div>
            </div>
            <div v-else class="flex items-start gap-3">
              <div
                class="size-8 bg-primary text-primary-foreground grid place-items-center rounded-full shrink-0 mt-0.5"
                :class="isSpeaking && i === messages.length - 1 ? 'animate-pulse' : ''"
              >
                <Sparkles class="size-4" />
              </div>
              <div
                class="flex-1 bg-background border rounded-2xl px-4 py-3 text-base prose prose-base dark:prose-invert prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 max-w-none"
                v-html="renderMarkdown(msg.content)"
              />
            </div>
          </template>

          <div v-if="loading" class="flex items-start gap-3">
            <div class="size-8 bg-primary text-primary-foreground grid place-items-center rounded-full shrink-0 animate-pulse">
              <Sparkles class="size-4" />
            </div>
            <div class="bg-background border rounded-2xl px-4 py-3">
              <Loader2 class="size-5 animate-spin text-muted-foreground" />
            </div>
          </div>

          <div ref="messagesEnd" />
        </div>
      </div>

      <!-- Input dock -->
      <div class="shrink-0 border-t px-4 py-3 bg-background">
        <div class="max-w-2xl mx-auto flex flex-col gap-2">

          <!-- Context badges -->
          <div v-if="selectedItems.length > 0" class="flex flex-wrap gap-1.5">
            <Badge
              v-for="item in selectedItems"
              :key="item.id"
              variant="secondary"
              class="flex items-center gap-1 pr-1 text-sm py-1"
            >
              <component :is="contextIcons[item.type]" class="size-3.5 shrink-0" />
              <span class="max-w-[160px] truncate">{{ item.label }}</span>
              <button
                class="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                @click="selectedItems = selectedItems.filter(i => i.id !== item.id)"
              >
                <X class="size-3" />
              </button>
            </Badge>
          </div>

          <InputGroup>
            <InputGroupAddon align="block-start">
              <Drawer v-model:open="contextDrawerOpen">
                <DrawerTrigger as-child>
                  <Button
                    size="sm"
                    variant="outline"
                    :class="selectedItems.length > 0 ? 'border-primary/50 text-primary' : ''"
                  >
                    <AtSign class="size-4" />
                    Add Context
                    <Badge v-if="selectedItems.length > 0" variant="secondary" class="ml-1 text-xs px-1">
                      {{ selectedItems.length }}
                    </Badge>
                  </Button>
                </DrawerTrigger>

                <DrawerContent class="flex flex-col max-h-[75vh]">
                  <div class="flex flex-col h-full min-h-0">
                    <div class="px-4 pt-4 pb-2 border-b shrink-0">
                      <input v-model="contextSearch" placeholder="Search matters, deadlines, users…" class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </div>
                    <Tabs v-model="contextTab" class="flex flex-col flex-1 min-h-0">
                      <TabsList class="shrink-0 px-4 py-2 justify-start gap-1 border-b bg-transparent h-auto rounded-none">
                        <TabsTrigger value="matter" class="text-xs gap-1.5"><Building2 class="size-3" /> Matters</TabsTrigger>
                        <TabsTrigger value="deadline" class="text-xs gap-1.5"><Clock class="size-3" /> Deadlines</TabsTrigger>
                        <TabsTrigger value="user" class="text-xs gap-1.5"><User class="size-3" /> Users</TabsTrigger>
                      </TabsList>
                      <div v-if="contextLoading" class="flex items-center justify-center p-8">
                        <Loader2 class="size-5 animate-spin text-muted-foreground" />
                      </div>
                      <template v-else>
                        <TabsContent value="matter" class="overflow-y-auto flex-1 mt-0 pb-8">
                          <button
                            v-for="m in filteredMatters" :key="m.id"
                            class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0"
                            :class="isSelected(m.id) ? 'bg-accent' : ''"
                            @click="toggleItem({ type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber })"
                          >
                            <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium truncate">{{ m.name }}</span><span class="text-xs text-muted-foreground">{{ m.caseNumber }}</span></div>
                            <Check v-if="isSelected(m.id)" class="size-4 text-primary shrink-0" />
                          </button>
                          <p v-if="!filteredMatters.length" class="px-4 py-6 text-sm text-muted-foreground text-center">No matters found.</p>
                        </TabsContent>
                        <TabsContent value="deadline" class="overflow-y-auto flex-1 mt-0 pb-8">
                          <button
                            v-for="d in filteredDeadlines" :key="d.id"
                            class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0"
                            :class="isSelected(d.id) ? 'bg-accent' : ''"
                            @click="toggleItem({ type: 'deadline', id: d.id, label: d.name, sublabel: d.matterName })"
                          >
                            <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium truncate">{{ d.name }}</span><span class="text-xs text-muted-foreground truncate">{{ d.matterName }}</span></div>
                            <Check v-if="isSelected(d.id)" class="size-4 text-primary shrink-0" />
                          </button>
                          <p v-if="!filteredDeadlines.length" class="px-4 py-6 text-sm text-muted-foreground text-center">No pending deadlines found.</p>
                        </TabsContent>
                        <TabsContent value="user" class="overflow-y-auto flex-1 mt-0 pb-8">
                          <button
                            v-for="u in filteredUsers" :key="u.id"
                            class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0"
                            :class="isSelected(u.id) ? 'bg-accent' : ''"
                            @click="toggleItem({ type: 'user', id: u.id, label: u.name, sublabel: u.role })"
                          >
                            <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium">{{ u.name }}</span><span v-if="u.role" class="text-xs text-muted-foreground capitalize">{{ u.role }}</span></div>
                            <Check v-if="isSelected(u.id)" class="size-4 text-primary shrink-0" />
                          </button>
                          <p v-if="!filteredUsers.length" class="px-4 py-6 text-sm text-muted-foreground text-center">No users found.</p>
                        </TabsContent>
                      </template>
                    </Tabs>
                  </div>
                </DrawerContent>
              </Drawer>
            </InputGroupAddon>

            <InputGroupTextarea
              v-model="inputText"
              placeholder="Ask, search or chat…"
              @keydown="handleKeydown"
            />

            <InputGroupAddon align="block-end" class="ml-auto flex justify-end items-center gap-1">
              <Separator orientation="vertical" class="!h-4" />
              <InputGroupButton
                variant="default"
                class="rounded-full"
                size="icon-sm"
                :disabled="!inputText.trim() || loading"
                @click="sendTextInput"
              >
                <ArrowUpIcon class="size-4" />
                <span class="sr-only">Send</span>
              </InputGroupButton>
              <InputGroupButton
                :variant="isListening ? 'destructive' : 'default'"
                class="rounded-full"
                size="icon-sm"
                :class="isListening ? 'animate-pulse' : ''"
                :title="isListening ? 'Stop listening' : 'Speak to PractoAI'"
                @click="toggleMic"
              >
                <MicOff v-if="isListening" class="size-4" />
                <Mic v-else class="size-4" />
                <span class="sr-only">{{ isListening ? 'Stop' : 'Speak' }}</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

    </div>

    <!-- STT fullscreen overlay (recording + transcribing) -->
    <Transition name="stt-overlay">
      <div
        v-if="voiceState === 'listening' || voiceState === 'thinking'"
        class="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8 px-8"
        @click="isListening ? stopListening() : undefined"
      >
        <div class="flex flex-col items-center gap-6">
          <!-- Audio level bars (listening only) -->
          <div v-if="isListening" class="flex items-end gap-1.5 h-16">
            <div
              v-for="i in 7"
              :key="i"
              class="w-2 bg-primary rounded-full transition-all duration-75 ease-out"
              :style="{
                height: `${Math.max(6, audioLevel * (0.4 + 0.6 * Math.abs(Math.sin(i * 0.9))) )}px`,
                opacity: audioLevel > 2 ? 1 : 0.3,
              }"
            />
          </div>

          <!-- Mic / spinner button -->
          <div class="relative">
            <div
              v-if="isListening"
              class="absolute inset-0 rounded-full animate-ping scale-150 bg-primary/20"
            />
            <Button
              size="icon"
              class="relative size-24 rounded-full [&_svg]:size-10 shadow-xl pointer-events-none"
              :variant="isTranscribing ? 'secondary' : 'default'"
            >
              <Loader2 v-if="isTranscribing" class="animate-spin" />
              <Mic v-else />
            </Button>
          </div>
        </div>

        <div class="max-w-lg text-center">
          <p v-if="isTranscribing" class="text-xl text-muted-foreground">Transcribing…</p>
          <p
            v-else
            class="text-3xl font-medium leading-snug min-h-12"
            :class="transcript ? 'text-foreground' : 'text-muted-foreground'"
          >
            {{ transcript || 'Listening…' }}
          </p>
        </div>

        <p v-if="isListening" class="text-sm text-muted-foreground">Tap anywhere to stop</p>

        <Button
          v-if="isListening"
          size="lg"
          variant="outline"
          class="h-14 px-8 text-base rounded-full gap-2"
          @click.stop="stopListening"
        >
          <MicOff class="size-5" />
          Stop
        </Button>
      </div>
    </Transition>

    <!-- Voice settings sheet -->
    <Sheet v-model:open="voiceSettingsOpen">
      <SheetContent side="right" class="flex flex-col gap-0 p-0 w-full sm:max-w-sm overflow-y-auto">
        <div class="flex items-center gap-2 px-4 py-4 border-b shrink-0">
          <Settings class="size-4 text-muted-foreground" />
          <span class="font-semibold text-sm">Voice Settings</span>
        </div>

        <div class="flex flex-col gap-6 px-4 py-5">

          <!-- TTS Voice selector -->
          <div class="flex flex-col gap-3">
            <div>
              <p class="text-sm font-medium">Voice</p>
              <p class="text-xs text-muted-foreground mt-0.5">Select the ElevenLabs voice for AI responses</p>
            </div>

            <div v-if="voicesLoading" class="flex justify-center py-6">
              <Loader2 class="size-5 animate-spin text-muted-foreground" />
            </div>

            <div v-else-if="voices.length > 0" class="flex flex-col gap-1.5">
              <button
                v-for="v in voices"
                :key="v.voice_id"
                class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors hover:bg-accent flex items-center justify-between gap-2"
                :class="speechPrefs.voiceId === v.voice_id ? 'border-primary bg-primary/5' : 'border-border'"
                @click="selectVoice(v)"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="size-7 rounded-full grid place-items-center shrink-0 text-xs font-semibold"
                    :class="speechPrefs.voiceId === v.voice_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                  >
                    {{ v.name.charAt(0) }}
                  </div>
                  <span class="text-sm font-medium">{{ v.name }}</span>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="shrink-0"
                  :disabled="testPlaying"
                  @click.stop="testVoice(v.voice_id, v.name)"
                >
                  <Volume2 v-if="!testPlaying || speechPrefs.voiceId !== v.voice_id" class="size-3.5" />
                  <Loader2 v-else class="size-3.5 animate-spin" />
                </Button>
              </button>
            </div>

            <p v-else class="text-sm text-muted-foreground text-center py-4">
              Add your <code class="text-xs bg-muted px-1 rounded">ELEVENLABS_API_KEY</code> to the backend to load voices.
            </p>
          </div>

          <!-- Test text -->
          <div class="flex flex-col gap-2">
            <p class="text-sm font-medium">Test phrase</p>
            <InputGroupTextarea v-model="testText" class="text-sm" />
            <Button
              variant="outline"
              size="sm"
              class="gap-2"
              :disabled="testPlaying || !speechPrefs.voiceId"
              @click="testVoice(speechPrefs.voiceId, speechPrefs.voiceName)"
            >
              <Volume2 v-if="!testPlaying" class="size-4" />
              <Loader2 v-else class="size-4 animate-spin" />
              {{ testPlaying ? 'Playing…' : 'Play test' }}
            </Button>
          </div>

          <!-- Auto-read toggle -->
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Auto-read responses</p>
              <p class="text-xs text-muted-foreground mt-0.5">Read AI replies aloud automatically</p>
            </div>
            <Button
              size="sm"
              :variant="autoRead ? 'default' : 'outline'"
              @click="autoRead = !autoRead; if (!autoRead) stopSpeaking()"
            >
              {{ autoRead ? 'On' : 'Off' }}
            </Button>
          </div>

          <!-- Current voice info -->
          <div v-if="speechPrefs.voiceName" class="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            Active voice: <span class="font-medium text-foreground">{{ speechPrefs.voiceName }}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>

  </div>
</template>

<style scoped>
.proposal-enter-active,
.proposal-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.proposal-enter-from,
.proposal-leave-to { opacity: 0; transform: translateY(-8px); }

.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active { transition: opacity 0.25s ease; }
.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to { opacity: 0; }

.stt-overlay-enter-active,
.stt-overlay-leave-active { transition: opacity 0.2s ease; }
.stt-overlay-enter-from,
.stt-overlay-leave-to { opacity: 0; }
</style>
