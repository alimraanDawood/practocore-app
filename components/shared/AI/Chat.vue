<script lang="ts" setup>
import {
  AtSign, ArrowUpIcon, Paperclip, Globe,
  Mic, MicOff, VolumeX, Volume2, X, Check, Loader2, Sparkles,
  Building2, Clock, User,
  History, Plus, Trash2, MessageSquare, Settings, Lock,
} from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '~/components/ui/sheet';
import ProposalCard from './ProposalCard.vue';
import { initials } from './proposals/theme';
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

marked.use({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

const props = defineProps<{ currentMatterId?: string }>();
const open = defineModel<boolean>('open', { default: false });

const isDesktop = useMediaQuery('(min-width: 1024px)');

// ── Speech ────────────────────────────────────────────────────────────────────
const {
  isListening, isTranscribing, transcript, audioLevel, micError,
  startListening, stopListening,
  isSpeaking, ttsSupported, speak, stopSpeaking, unlockAudio,
  prefs: speechPrefs, savePrefs,
} = useSpeech();

// ── Mode ──────────────────────────────────────────────────────────────────────
const audioMode = ref(false);

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
const voiceState = ref<VoiceState>('idle');

// Close audio mode when the sheet closes
watch(open, (isOpen) => {
  if (!isOpen && audioMode.value) exitAudioMode();
});

// ── Conversational loop ───────────────────────────────────────────────────────

// Silence detection: after user starts speaking, auto-stop when silence persists
let hasSpoken = false;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;

function clearSilenceTimer() {
  if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
}

watch(isListening, (listening) => {
  if (listening) {
    hasSpoken = false;
    clearSilenceTimer();
    voiceState.value = 'listening';
  } else {
    clearSilenceTimer();
    if (voiceState.value === 'listening') voiceState.value = 'thinking';
  }
});

// Level above which we count as intentional speech (filters ambient noise / soft background sounds)
const SPEECH_THRESHOLD = 18;

watch(audioLevel, (level) => {
  if (!isListening.value || !audioMode.value) return;
  if (level > SPEECH_THRESHOLD) {
    hasSpoken = true;
    clearSilenceTimer();
  } else if (hasSpoken && !silenceTimer) {
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      if (isListening.value) stopListening();
    }, 1600);
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
  clearSilenceTimer();
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
    clearSilenceTimer();
    stopListening();
  } else {
    stopSpeaking();
    startListening();
  }
}

function exitAudioMode() {
  clearSilenceTimer();
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
const conversationId = ref<string>('');
const pendingProposal = ref<AiResponse | null>(null);
const inputText = ref('');
const loading = ref(false);
const messagesEnd = ref<HTMLElement | null>(null);

const firstName = computed(() => getSignedInUser()?.name?.split(' ').at(0) || 'there');

// PractoAI calls cost money, so chatting requires a live plan. Gates the input
// (text + voice + send) and surfaces a quiet banner when the plan has lapsed.
const activePlan = usePlanActive();
const isSubscriptionActive = computed(() => activePlan.value?.active === true);

const canSend = computed(() => inputText.value.trim().length > 0 && !loading.value && isSubscriptionActive.value);

const lastAssistantText = computed(() => {
  const msgs = messages.value.filter((m): m is AiMessage => m.role === 'assistant');
  return msgs.at(-1)?.content ?? '';
});

const lastUserText = computed(() => {
  const msgs = messages.value.filter((m): m is AiMessage => m.role === 'user');
  return msgs.at(-1)?.content ?? '';
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
  messages.value = (conv.messages ?? []).map((m): ChatMessage => {
    if (m.role.startsWith('tool-event:')) {
      const status = m.role.slice('tool-event:'.length) as 'approved' | 'rejected';
      return { role: 'tool-event', content: m.content, status };
    }
    return m as AiMessage;
  });
  conversationId.value = conv.id;
  pendingProposal.value = null;
  historyOpen.value = false;
  scrollToBottom();
}

function newChat() {
  messages.value = [];
  conversationId.value = '';
  pendingProposal.value = null;
  inputText.value = '';
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
  if (!text || loading.value || !isSubscriptionActive.value) return;

  messages.value.push({ role: 'user', content: text });
  if (!voiceText) inputText.value = '';
  pendingProposal.value = null;
  loading.value = true;
  voiceState.value = 'thinking';
  scrollToBottom();

  const response = await sendAiMessage(apiMessages.value, buildContext(), conversationId.value || undefined);
  loading.value = false;

  if (response.type === 'text') {
    messages.value.push({ role: 'assistant', content: response.content ?? '' });
    if (response.conversationId) {
      const isNew = !conversationId.value;
      conversationId.value = response.conversationId;
      if (isNew && historyLoaded.value) {
        await refreshHistory();
      } else if (!isNew && historyLoaded.value) {
        const idx = conversations.value.findIndex(c => c.id === response.conversationId);
        if (idx >= 0) conversations.value[idx]!.updated = new Date().toISOString();
      }
    }
    if (audioMode.value) speak(response.content ?? '');
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

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function prefill(text: string) { inputText.value = text; }

function goToBilling() {
  open.value = false;
  navigateTo('/main/settings/billing');
}

function dismissProposal() {
  if (pendingProposal.value) {
    messages.value.push({ role: 'tool-event', content: formatToolName(pendingProposal.value.tool ?? ''), status: 'rejected' });
  }
  pendingProposal.value = null;
}

const proposalLoading = ref(false);

async function approveProposal() {
  if (!pendingProposal.value || proposalLoading.value) return;
  // Approving applies matter changes (fulfill/adjourn/edit) — block when the
  // subscription has lapsed. The proposal stays pending so it can be applied
  // once the plan is renewed.
  if (!isSubscriptionActive.value) {
    messages.value.push({ role: 'assistant', content: 'Your subscription has expired. Renew your plan to apply changes.' });
    return;
  }
  proposalLoading.value = true;
  const proposal = pendingProposal.value;
  pendingProposal.value = null;

  messages.value.push({ role: 'tool-event', content: formatToolName(proposal.tool ?? ''), status: 'approved' });
  loading.value = true;
  voiceState.value = 'thinking';
  scrollToBottom();

  const response = await confirmAiProposal(
    proposal,
    true,
    buildContext(),
    conversationId.value || undefined,
    convMessages.value,
  );
  loading.value = false;
  proposalLoading.value = false;

  if (response.type === 'text') {
    messages.value.push({ role: 'assistant', content: response.content ?? '' });
    if (response.conversationId) {
      conversationId.value = response.conversationId;
      if (historyLoaded.value) refreshHistory();
    }
    if (audioMode.value) speak(response.content ?? '');
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
        ? 'flex flex-col p-0 gap-0 overflow-hidden w-[760px] max-w-[calc(100vw-2rem)] h-[82vh] max-h-[82vh]'
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
              <div v-else-if="msg.role === 'user'" class="flex justify-end">
                <div class="max-w-[80%] bg-muted text-muted-foreground border rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
                  {{ msg.content }}
                </div>
              </div>
              <div v-else class="flex items-start gap-2 group/msg">
                <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
                  <Sparkles class="size-3" />
                </div>
                <div class="flex flex-col gap-0.5 max-w-[80%]">
                  <div
                    class="bg-background border text-foreground rounded-lg px-3 py-2 text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-xs max-w-none"
                    v-html="renderMarkdown(msg.content)"
                  />
                  <button
                    class="self-start flex items-center gap-1 text-muted-foreground hover:text-foreground transition-all opacity-40 sm:opacity-0 sm:group-hover/msg:opacity-100 px-0.5"
                    :class="speakingIdx === i ? '!opacity-100 text-primary' : ''"
                    @click="toggleSpeak(msg.content, i)"
                  >
                    <VolumeX v-if="speakingIdx === i" class="size-3" />
                    <Volume2 v-else class="size-3" />
                  </button>
                </div>
              </div>
            </template>

            <div v-if="loading" class="flex items-start gap-2">
              <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
                <Sparkles class="size-3" />
              </div>
              <div class="bg-background border rounded-lg px-3 py-2">
                <Loader2 class="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>

            <ProposalCard
              v-if="pendingProposal"
              :proposal="pendingProposal"
              variant="panel"
              :loading="proposalLoading"
              @approve="approveProposal"
              @dismiss="dismissProposal"
            />

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
                :placeholder="isSubscriptionActive ? 'Ask, Search or Chat...' : 'Subscription required to chat'"
                :disabled="!isSubscriptionActive"
                @keydown="handleKeydown"
              />

              <InputGroupAddon align="block-end">
                <InputGroupButton variant="outline" size="icon-sm">
                  <Paperclip class="size-4" />
                </InputGroupButton>
                <InputGroupButton variant="outline" size="sm">
                  <Globe />
                  Sources
                </InputGroupButton>
                <Separator orientation="vertical" class="!h-4 ml-auto" />
                <InputGroupButton
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
                  :disabled="!isSubscriptionActive"
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
