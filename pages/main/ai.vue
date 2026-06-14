<script lang="ts" setup>
import {
  Sparkles, Mic, MicOff, ArrowUpIcon, X, Check, Loader2,
  Plus, Trash2, MessageSquare, AtSign, Building2, Clock, User,
  Volume2, VolumeX, ChevronLeft, Menu, Settings,
} from 'lucide-vue-next';
import type { VoiceEntry } from '~/composables/useSpeech';
import { getSignedInUser } from '~/services/auth';
import {
  sendAiMessage, confirmAiProposal,
  listConversations, getConversation, deleteConversation,
  type AiMessage, type AiResponse, type AiContext, type AiConversationSummary,
  type ConvDisplayMessage,
} from '~/services/ai';
import { getMatters, getAllDeadlines } from '~/services/matters';
import { getOrganisationUsers } from '~/services/admin';
import ProposalCard from '~/components/shared/AI/ProposalCard.vue';

definePageMeta({ layout: 'blank' });

// ── Speech ────────────────────────────────────────────────────────────────────
const {
  isListening, isTranscribing, transcript, audioLevel, micError,
  startListening, stopListening,
  isSpeaking, ttsSupported, caption, speak, speakTimed, stopSpeaking,
  prefs: speechPrefs, savePrefs,
} = useSpeech();

const autoRead = ref(true);

// ── Mode ──────────────────────────────────────────────────────────────────────
const audioMode = ref(false);

function exitAudioMode() {
  stopListening();
  stopSpeaking();
  voiceState.value = 'idle';
  audioMode.value = false;
}

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

const lastAssistantText = computed(() => {
  const msgs = messages.value.filter((m): m is AiMessage => m.role === 'assistant');
  return msgs.at(-1)?.content ?? '';
});

const lastUserText = computed(() => {
  const msgs = messages.value.filter((m): m is AiMessage => m.role === 'user');
  return msgs.at(-1)?.content ?? '';
});

// ── Voice state machine ───────────────────────────────────────────────────────
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
const voiceState = ref<VoiceState>('idle');

watch(isListening, (listening) => {
  if (!listening && voiceState.value === 'listening') voiceState.value = 'thinking';
});

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
    if (t && isUsableTranscript(t)) sendMessage(t);
    else voiceState.value = 'idle';
  }
});

watch(isSpeaking, (speaking) => {
  if (speaking) voiceState.value = 'speaking';
  else if (voiceState.value === 'speaking') voiceState.value = 'idle';
});

watch(micError, (err) => {
  if (err) voiceState.value = 'idle';
});

// ── Orb visual helpers ────────────────────────────────────────────────────────
function barHeight(i: number): number {
  if (!isListening.value) return 4;
  const base = 4;
  const wave = Math.abs(Math.sin((i + 1) * 0.9 + Date.now() / 200));
  return Math.max(base, (audioLevel.value / 100) * 40 * wave + base);
}

function liveBarHeight(i: number): number {
  const isActive = voiceState.value === 'listening' || voiceState.value === 'speaking';
  if (!isActive) return 3;
  const wave = Math.abs(Math.sin((i + 1) * 1.5 + Date.now() / 250));
  return Math.max(3, (audioLevel.value / 100) * 12 * wave + 3);
}

const outerRingScale = computed(() => {
  if (voiceState.value === 'listening') return 1 + (audioLevel.value / 100) * 0.6;
  if (voiceState.value === 'speaking') return 1.3;
  return 1;
});
const innerRingScale = computed(() => {
  if (voiceState.value === 'listening') return 1 + (audioLevel.value / 100) * 0.35;
  if (voiceState.value === 'speaking') return 1.15;
  return 1;
});

// ── Voice settings panel ──────────────────────────────────────────────────────
const voiceSettingsOpen = ref(false);
const voices = ref<VoiceEntry[]>([]);
const voicesLoading = ref(false);
const testText = ref('The deadline for filing submissions is March 15th. Please review the matter urgently.');
const testPlaying = ref(false);

watch(voiceSettingsOpen, async (open) => {
  if (!open || voices.value.length > 0) return;
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

function toggleMic() {
  if (!audioMode.value) {
    audioMode.value = true;
    if (!isListening.value) {
      stopSpeaking();
      voiceState.value = 'listening';
      startListening();
    }
    return;
  }
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
  const todayG: AiConversationSummary[] = [], yestG: AiConversationSummary[] = [],
    weekG: AiConversationSummary[] = [], olderG: AiConversationSummary[] = [];
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
    if (autoRead.value && ttsSupported.value) (audioMode.value ? speakTimed : speak)(response.content ?? '');
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
    if (autoRead.value && ttsSupported.value) (audioMode.value ? speakTimed : speak)(response.content ?? '');
    else voiceState.value = 'idle';
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
    voiceState.value = 'idle';
  } else {
    messages.value.push({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
    voiceState.value = 'idle';
  }
}

function formatToolName(tool: string): string {
  return tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const SUGGESTIONS = [
  'What deadlines are due this week?',
  'Search for recent matters',
  'Adjourn an upcoming deadline',
  'Who is assigned to a matter?',
];

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

    <!-- ═══════════════════════════════════════════════════════════════════════
         AUDIO MODE OVERLAY
    ════════════════════════════════════════════════════════════════════════ -->
    <Transition name="audio-mode">
      <div v-if="audioMode" class="fixed inset-0 z-50 flex flex-col overflow-hidden" style="background: #07080f">

        <!-- Gradient blob (Gemini-style aurora at bottom) -->
        <div class="audio-bg-blob pointer-events-none" />

        <!-- Proposal card (floating above controls) -->
        <Transition name="fade">
          <ProposalCard
            v-if="pendingProposal"
            :proposal="pendingProposal"
            variant="glass"
            :loading="proposalLoading"
            class="absolute bottom-36 left-4 right-4 z-10"
            @approve="approveProposal"
            @dismiss="dismissProposal"
          />
        </Transition>

        <!-- Top bar -->
        <div class="relative z-10 flex items-center justify-between px-5 pt-safe" style="padding-top: max(env(safe-area-inset-top), 1.25rem)">
          <div class="flex items-center gap-2">
            <!-- Live audio indicator bars -->
            <div class="flex items-end gap-0.5" style="height: 16px">
              <div
                v-for="i in 4" :key="i"
                class="w-0.5 rounded-full bg-white/60 transition-all duration-75 ease-out"
                :style="{ height: `${liveBarHeight(i)}px` }"
              />
            </div>
            <span class="text-white/70 text-sm font-medium tracking-wide">Live</span>
          </div>
          <button
            class="size-9 rounded-xl bg-white/10 grid place-items-center backdrop-blur-sm"
            title="Back to chat"
            @click="exitAudioMode"
          >
            <MessageSquare class="size-4 text-white/70" />
          </button>
        </div>

        <!-- Center — last exchange + orb -->
        <div class="flex-1 flex flex-col items-center justify-center gap-8 px-8">

          <!-- Last exchange text -->
          <div class="w-full max-w-xs text-center space-y-3 min-h-[4rem] flex flex-col items-center justify-center">
            <Transition name="fade">
              <p v-if="voiceState === 'listening' && transcript" class="text-white text-xl font-medium leading-snug">{{ transcript }}</p>
              <p v-else-if="voiceState === 'listening'" class="text-white/40 text-sm animate-pulse">Listening…</p>
              <p v-else-if="voiceState === 'thinking'" class="text-white/40 text-sm">Thinking…</p>
              <p v-else-if="voiceState === 'speaking' && caption" class="text-white/90 text-base leading-relaxed line-clamp-5">{{ caption }}</p>
              <p v-else-if="voiceState === 'speaking'" class="text-white/40 text-sm animate-pulse">Speaking…</p>
              <div v-else-if="lastAssistantText" class="space-y-2">
                <p v-if="lastUserText" class="text-white/30 text-xs truncate">{{ lastUserText }}</p>
                <p class="text-white/70 text-sm leading-relaxed line-clamp-4">{{ lastAssistantText }}</p>
              </div>
              <p v-else class="text-white/30 text-sm">Tap the mic and ask anything</p>
            </Transition>
          </div>

          <!-- Orb -->
          <div class="relative flex items-center justify-center size-40">
            <div
              class="absolute size-40 rounded-full transition-transform duration-75 ease-out"
              :class="voiceState === 'idle' ? 'bg-blue-500/5' : 'bg-blue-500/10'"
              :style="{ transform: `scale(${outerRingScale})` }"
            />
            <div
              class="absolute size-40 rounded-full transition-transform duration-75 ease-out"
              :class="voiceState === 'idle' ? 'bg-blue-500/8' : 'bg-blue-500/15'"
              :style="{ transform: `scale(${innerRingScale})` }"
            />
            <div
              class="relative z-10 size-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300"
              style="background: linear-gradient(135deg, #3b82f6, #6366f1); box-shadow: 0 20px 60px rgba(99, 102, 241, 0.4)"
              :class="{
                'scale-105': voiceState === 'listening',
                'animate-pulse': voiceState === 'speaking',
              }"
            >
              <template v-if="voiceState === 'listening'">
                <div class="flex items-end gap-1 h-10">
                  <div
                    v-for="i in 7" :key="i"
                    class="w-1 bg-white rounded-full transition-all duration-75 ease-out"
                    :style="{ height: `${barHeight(i)}px` }"
                  />
                </div>
              </template>
              <template v-else-if="voiceState === 'thinking'">
                <Loader2 class="size-10 animate-spin text-white/90" />
              </template>
              <template v-else>
                <Sparkles class="size-10 text-white/90" />
              </template>
            </div>
          </div>

        </div>

        <!-- Bottom controls (Gemini-style pill row) -->
        <div
          class="relative z-10 flex items-center justify-center gap-3 px-6"
          style="padding-bottom: max(env(safe-area-inset-bottom), 2rem)"
        >
          <!-- Context button -->
          <button
            class="size-14 rounded-full bg-white/10 backdrop-blur-sm grid place-items-center relative transition-colors hover:bg-white/20"
            title="Add context"
            @click="contextDrawerOpen = true"
          >
            <AtSign class="size-5 text-white/80" />
            <div v-if="selectedItems.length" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-500 rounded-full text-[10px] text-white grid place-items-center font-semibold px-1">
              {{ selectedItems.length }}
            </div>
          </button>

          <!-- Stop speaking -->
          <button
            v-if="isSpeaking"
            class="size-14 rounded-full bg-white/10 backdrop-blur-sm grid place-items-center transition-colors hover:bg-white/20"
            title="Stop speaking"
            @click="stopSpeaking"
          >
            <VolumeX class="size-5 text-white/80" />
          </button>

          <!-- Mic toggle -->
          <button
            class="size-14 rounded-full backdrop-blur-sm grid place-items-center transition-all"
            :class="isListening
              ? 'bg-white/20 ring-2 ring-white/30 scale-105'
              : 'bg-white/10 hover:bg-white/20'"
            :disabled="voiceState === 'thinking'"
            @click="toggleMic"
          >
            <MicOff v-if="isListening" class="size-5 text-white" />
            <Mic v-else class="size-5 text-white/80" />
          </button>

          <!-- Exit audio mode (red pill — primary exit action) -->
          <button
            class="h-14 px-7 rounded-full flex items-center justify-center shadow-lg transition-opacity hover:opacity-90"
            style="background: #ef4444; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4)"
            title="End voice session"
            @click="exitAudioMode"
          >
            <X class="size-5 text-white" />
          </button>
        </div>

      </div>
    </Transition>

    <!-- ═══════════════════════════════════════════════════════════════════════
         CHAT MODE
    ════════════════════════════════════════════════════════════════════════ -->

    <!-- Sidebar overlay (mobile) -->
    <Transition name="sidebar-overlay">
      <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-black/50 lg:hidden" @click="sidebarOpen = false" />
    </Transition>

    <!-- History sidebar -->
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
          <Plus class="size-4" /> New Conversation
        </Button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div v-if="historyLoading" class="flex justify-center py-8">
          <Loader2 class="size-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else-if="groupedConversations.length > 0">
          <div v-for="group in groupedConversations" :key="group.label" class="mb-2">
            <p class="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">{{ group.label }}</p>
            <button
              v-for="conv in group.items" :key="conv.id"
              class="group w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-2.5"
              :class="conversationId === conv.id ? 'bg-accent' : ''"
              @click="loadConversation(conv.id)"
            >
              <MessageSquare class="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span class="flex-1 text-sm truncate leading-snug">{{ conv.title }}</span>
              <button class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0" @click.stop="removeConversation(conv.id)">
                <Trash2 class="size-3.5" />
              </button>
            </button>
          </div>
        </template>
        <p v-else class="px-3 py-8 text-sm text-muted-foreground text-center">No conversations yet.</p>
      </div>
    </aside>

    <!-- Main chat area -->
    <div class="flex flex-col flex-1 min-w-0">

      <!-- Header -->
      <header class="flex items-center gap-2 px-4 h-14 border-b shrink-0">
        <Button size="icon-sm" variant="ghost" class="lg:hidden" @click="sidebarOpen = true"><Menu class="size-4" /></Button>
        <Button size="icon-sm" variant="ghost" @click="navigateTo(-1 as any)"><ChevronLeft class="size-4" /></Button>
        <div class="flex items-center gap-2">
          <div class="size-7 bg-primary text-primary-foreground grid place-items-center rounded-full" :class="isSpeaking ? 'animate-pulse' : ''">
            <Sparkles class="size-3.5" />
          </div>
          <span class="font-semibold text-sm">PractoAI</span>
        </div>
        <div class="ml-auto flex items-center gap-1">
          <SharedDarkModeSwitch />
          <Button
            size="icon-sm" variant="ghost"
            :class="autoRead ? 'text-primary' : 'text-muted-foreground'"
            :title="autoRead ? 'Auto-read on' : 'Auto-read off'"
            @click="autoRead = !autoRead; if (!autoRead) stopSpeaking()"
          >
            <Volume2 v-if="autoRead" class="size-4" /><VolumeX v-else class="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" @click="newChat"><Plus class="size-4" /></Button>
          <Button size="icon-sm" variant="ghost" title="Voice settings" @click="voiceSettingsOpen = true"><Settings class="size-4" /></Button>
        </div>
      </header>

      <!-- Mic error banner -->
      <Transition name="fade">
        <div v-if="micError" class="shrink-0 px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <MicOff class="size-4 shrink-0" />
          <span class="flex-1">{{ micError }}</span>
          <button class="shrink-0 hover:opacity-70" @click="micError = ''"><X class="size-4" /></button>
        </div>
      </Transition>

      <!-- Proposal banner (chat mode) -->
      <Transition name="fade">
        <div v-if="pendingProposal && !audioMode" class="shrink-0 px-4 py-3 border-b bg-muted/30">
          <ProposalCard
            :proposal="pendingProposal"
            variant="panel"
            :loading="proposalLoading"
            class="max-w-lg mx-auto"
            @approve="approveProposal"
            @dismiss="dismissProposal"
          />
        </div>
      </Transition>

      <!-- Message thread -->
      <div class="flex-1 overflow-y-auto">

        <!-- Empty state -->
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full gap-6 px-6">
          <div class="text-center">
            <div class="size-16 bg-primary text-primary-foreground grid place-items-center rounded-full mx-auto mb-4">
              <Sparkles class="size-8" />
            </div>
            <p class="text-lg font-semibold">Hi {{ firstName }}</p>
            <p class="text-muted-foreground text-sm mt-1">What can I help you with today?</p>
          </div>
          <div class="grid grid-cols-2 gap-2 w-full max-w-sm">
            <button
              v-for="s in SUGGESTIONS" :key="s"
              class="text-left text-sm px-3 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors leading-snug"
              @click="sendMessage(s)"
            >{{ s }}</button>
          </div>
        </div>

        <!-- Messages -->
        <div v-else class="flex flex-col gap-4 px-4 py-4 max-w-2xl mx-auto w-full">
          <template v-for="(msg, idx) in messages" :key="idx">

            <!-- User -->
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div class="max-w-[80%] bg-muted rounded-2xl px-4 py-2.5 text-sm leading-relaxed">{{ msg.content }}</div>
            </div>

            <!-- Assistant -->
            <div v-else-if="msg.role === 'assistant'" class="flex items-start gap-2.5 group/msg">
              <div
                class="size-7 bg-primary text-primary-foreground grid place-items-center rounded-full shrink-0 mt-0.5"
                :class="speakingIdx === idx ? 'animate-pulse' : ''"
              >
                <Sparkles class="size-3.5" />
              </div>
              <div class="flex flex-col gap-1 flex-1 min-w-0">
                <div class="text-sm leading-relaxed whitespace-pre-wrap">{{ msg.content }}</div>
                <button
                  class="self-start flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-all opacity-40 sm:opacity-0 sm:group-hover/msg:opacity-100"
                  :class="speakingIdx === idx ? '!opacity-100 !text-primary' : ''"
                  @click="toggleSpeak(msg.content, idx)"
                >
                  <VolumeX v-if="speakingIdx === idx" class="size-3.5" />
                  <Volume2 v-else class="size-3.5" />
                </button>
              </div>
            </div>

            <!-- Tool event -->
            <div v-else-if="msg.role === 'tool-event'" class="flex justify-center">
              <div class="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                <Check v-if="(msg as ToolEvent).status === 'approved'" class="size-3 text-green-500" />
                <X v-else class="size-3 text-destructive" />
                {{ msg.content }}
                <span class="text-muted-foreground/60">· {{ (msg as ToolEvent).status }}</span>
              </div>
            </div>

          </template>

          <!-- Thinking dots -->
          <div v-if="loading" class="flex items-start gap-2.5">
            <div class="size-7 bg-primary text-primary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
              <Sparkles class="size-3.5" />
            </div>
            <div class="flex items-center gap-1 h-7 pt-1">
              <div v-for="i in 3" :key="i" class="size-1.5 bg-muted-foreground/50 rounded-full animate-bounce" :style="{ animationDelay: `${(i - 1) * 0.15}s` }" />
            </div>
          </div>

          <div ref="messagesEnd" />
        </div>
      </div>

      <!-- Input area -->
      <div class="shrink-0 border-t px-4 py-3">

        <!-- Context chips -->
        <div v-if="selectedItems.length" class="flex flex-wrap gap-1.5 mb-2">
          <button
            v-for="item in selectedItems" :key="item.id"
            class="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            @click="toggleItem(item)"
          >
            <Building2 v-if="item.type === 'matter'" class="size-3" />
            <Clock v-else-if="item.type === 'deadline'" class="size-3" />
            <User v-else class="size-3" />
            {{ item.label }}
            <X class="size-3 ml-0.5" />
          </button>
        </div>

        <div class="flex items-end gap-2">
          <InputGroup class="flex-1">
            <InputGroupTextarea v-model="inputText" placeholder="Message PractoAI…" @keydown="handleKeydown" />
            <InputGroupAddon align="block-end" class="flex items-center gap-1 pb-1 pr-1">
              <!-- Context -->
              <Drawer v-model:open="contextDrawerOpen">
                <DrawerTrigger as-child>
                  <Button size="icon-sm" variant="ghost" class="rounded-full shrink-0 relative" title="Add context">
                    <AtSign class="size-3.5" />
                    <span v-if="selectedItems.length" class="absolute -top-0.5 -right-0.5 size-3.5 bg-primary rounded-full text-[9px] text-primary-foreground grid place-items-center font-semibold">
                      {{ selectedItems.length }}
                    </span>
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
                      <div v-if="contextLoading" class="flex items-center justify-center p-8"><Loader2 class="size-5 animate-spin text-muted-foreground" /></div>
                      <template v-else>
                        <TabsContent value="matter" class="overflow-y-auto flex-1 mt-0 pb-8">
                          <button v-for="m in filteredMatters" :key="m.id" class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0" :class="isSelected(m.id) ? 'bg-accent' : ''" @click="toggleItem({ type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber })">
                            <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium truncate">{{ m.name }}</span><span class="text-xs text-muted-foreground">{{ m.caseNumber }}</span></div>
                            <Check v-if="isSelected(m.id)" class="size-4 text-primary shrink-0" />
                          </button>
                          <p v-if="!filteredMatters.length" class="px-4 py-6 text-sm text-muted-foreground text-center">No matters found.</p>
                        </TabsContent>
                        <TabsContent value="deadline" class="overflow-y-auto flex-1 mt-0 pb-8">
                          <button v-for="d in filteredDeadlines" :key="d.id" class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0" :class="isSelected(d.id) ? 'bg-accent' : ''" @click="toggleItem({ type: 'deadline', id: d.id, label: d.name, sublabel: d.matterName })">
                            <div class="flex flex-col flex-1 min-w-0"><span class="text-sm font-medium truncate">{{ d.name }}</span><span class="text-xs text-muted-foreground truncate">{{ d.matterName }}</span></div>
                            <Check v-if="isSelected(d.id)" class="size-4 text-primary shrink-0" />
                          </button>
                          <p v-if="!filteredDeadlines.length" class="px-4 py-6 text-sm text-muted-foreground text-center">No pending deadlines found.</p>
                        </TabsContent>
                        <TabsContent value="user" class="overflow-y-auto flex-1 mt-0 pb-8">
                          <button v-for="u in filteredUsers" :key="u.id" class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0" :class="isSelected(u.id) ? 'bg-accent' : ''" @click="toggleItem({ type: 'user', id: u.id, label: u.name, sublabel: u.role })">
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

              <!-- Mic → enters audio mode -->
              <Button
                size="icon-sm"
                variant="ghost"
                class="rounded-full shrink-0"
                title="Switch to voice mode"
                @click="toggleMic"
              >
                <Mic class="size-3.5" />
              </Button>

              <!-- Send -->
              <Button
                size="icon-sm"
                variant="default"
                class="rounded-full shrink-0"
                :disabled="!inputText.trim() || loading"
                @click="sendTextInput"
              >
                <ArrowUpIcon class="size-3.5" />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

    </div>

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
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Auto-read responses</p>
              <p class="text-xs text-muted-foreground mt-0.5">Read AI replies aloud automatically</p>
            </div>
            <Button size="sm" :variant="autoRead ? 'default' : 'outline'" @click="autoRead = !autoRead; if (!autoRead) stopSpeaking()">{{ autoRead ? 'On' : 'Off' }}</Button>
          </div>
          <div v-if="speechPrefs.voiceName" class="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            Active voice: <span class="font-medium text-foreground">{{ speechPrefs.voiceName }}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>

  </div>
</template>

<style scoped>
/* Audio mode enter/leave */
.audio-mode-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.audio-mode-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.audio-mode-enter-from  { opacity: 0; transform: scale(0.97); }
.audio-mode-leave-to    { opacity: 0; transform: scale(0.97); }

/* Gemini-style gradient blob at the bottom of audio mode */
.audio-bg-blob {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 55%;
  background: radial-gradient(
    ellipse 100% 80% at 50% 100%,
    rgba(59, 130, 246, 0.28) 0%,
    rgba(99, 102, 241, 0.18) 35%,
    rgba(139, 92, 246, 0.08) 60%,
    transparent 80%
  );
  filter: blur(2px);
}

.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active { transition: opacity 0.25s ease; }
.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to { opacity: 0; }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
