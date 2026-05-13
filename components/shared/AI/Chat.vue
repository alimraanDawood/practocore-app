<script lang="ts" setup>
import {
  AtSign, ArrowUpIcon, Paperclip, Globe, AudioLines,
  Loader2, Sparkles, X, Building2, Clock, User, Check,
  History, Plus, Trash2, MessageSquare,
} from 'lucide-vue-next';
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

// ── Chat ──────────────────────────────────────────────────────────────────────
type ToolEvent = { role: 'tool-event'; content: string; status: 'approved' | 'rejected' };
type ChatMessage = AiMessage | ToolEvent;

const messages = ref<ChatMessage[]>([]);

// For the Claude API — tool-event markers must be excluded.
const apiMessages = computed(() =>
  messages.value.filter((m): m is AiMessage => m.role !== 'tool-event'),
);

// For persistence — tool-events are encoded as "tool-event:approved" / "tool-event:rejected" roles.
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
const canSend = computed(() => inputText.value.trim().length > 0 && !loading.value);

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

// Seed from prop — only once; user can then add/remove freely
watch(
  () => props.currentMatterId,
  (id) => {
    if (!id) return;
    const alreadyIn = selectedItems.value.some(i => i.type === 'matter' && i.id === id);
    if (alreadyIn) return;
    selectedItems.value.push({ type: 'matter', id, label: 'Loading…' });
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

    mattersList.value = (mattersRes.items ?? []).map((m: any) => ({
      id: m.id, name: m.name, caseNumber: m.caseNumber,
    }));

    deadlinesList.value = (deadlinesRes ?? []).map((d: any) => ({
      id: d.id, name: d.name, matterName: d.expand?.matter?.name ?? '',
    }));

    usersList.value = (usersRes.items ?? []).map((u: any) => ({
      id: u.id, name: u.name, role: u.organisationRole ?? u.role ?? '',
    }));

    // Resolve placeholder labels seeded from the prop
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

// ── Messaging ─────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }));
}

async function send() {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  pendingProposal.value = null;
  loading.value = true;
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
        // Update title/updated in local list
        const idx = conversations.value.findIndex(c => c.id === response.conversationId);
        if (idx >= 0) conversations.value[idx].updated = new Date().toISOString();
      }
    }
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
  } else {
    messages.value.push({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
  }

  scrollToBottom();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function prefill(text: string) { inputText.value = text; }
function dismissProposal() {
  if (pendingProposal.value) {
    messages.value.push({ role: 'tool-event', content: formatToolName(pendingProposal.value.tool ?? ''), status: 'rejected' });
  }
  pendingProposal.value = null;
}

const proposalLoading = ref(false);

async function approveProposal() {
  if (!pendingProposal.value || proposalLoading.value) return;
  proposalLoading.value = true;
  const proposal = pendingProposal.value;
  pendingProposal.value = null;

  messages.value.push({ role: 'tool-event', content: formatToolName(proposal.tool ?? ''), status: 'approved' });
  loading.value = true;
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
  } else if (response.type === 'proposal') {
    pendingProposal.value = response;
  } else {
    messages.value.push({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
  }
  scrollToBottom();
}

function formatToolName(tool: string): string {
  return tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function proposalSummaryLines(input: Record<string, any> | undefined): string[] {
  if (!input) return [];
  const labels: Record<string, string> = {
    new_date: 'New date',
    reason: 'Reason',
    force: 'Force',
    assignee_ids: 'Assignees',
  };
  return Object.entries(input)
    .filter(([k]) => k !== 'deadline_id' && k !== 'matter_id')
    .map(([k, v]) => {
      const label = labels[k] ?? k.replace(/_/g, ' ');
      const value = Array.isArray(v) ? `${v.length} user(s)` : String(v);
      return `${label}: ${value}`;
    });
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetTrigger v-if="$slots.default" as-child>
      <slot />
    </SheetTrigger>

    <SheetContent
      side="bottom"
      class="flex flex-col p-0 gap-0"
      :hideX="true"
      :class="messages.length > 0 ? 'h-dvh' : 'h-auto'"
      @escape-key-down="(e: Event) => { if (contextDrawerOpen) e.preventDefault(); }"
      @pointer-down-outside="(e: Event) => { if (contextDrawerOpen) e.preventDefault(); }"
    >
      <!-- Header -->
      <div class="flex items-center px-4 py-3 border-b shrink-0 gap-2">
        <div class="size-7 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full">
          <Sparkles class="size-3.5" />
        </div>
        <span class="font-semibold text-sm">PractoAI</span>
        <div class="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            :class="historyOpen ? 'text-primary' : ''"
            @click="historyOpen = !historyOpen"
          >
            <History class="size-4" />
            <span class="sr-only">Toggle history</span>
          </Button>

          <Button
            size="icon-sm"
            variant="ghost"
            @click="open = false"
          >
            <X class="size-4" />
            <span class="sr-only">Close Chat window</span>
          </Button>
        </div>
      </div>

      <!-- Body: history + chat side-by-side -->
      <div class="flex flex-1 min-h-0 overflow-hidden">

        <!-- History panel -->
        <Transition name="history-panel">
        <div
          v-if="historyOpen"
          class="history-panel-inner w-60 shrink-0 border-r flex flex-col overflow-hidden"
        >
          <div class="px-3 py-2 border-b shrink-0">
            <Button size="sm" variant="outline" class="w-full gap-1.5" @click="newChat">
              <Plus class="size-3.5" />
              New Chat
            </Button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div v-if="historyLoading" class="flex items-center justify-center py-8">
              <Loader2 class="size-4 animate-spin text-muted-foreground" />
            </div>

            <template v-else-if="conversations.length > 0">
              <button
                v-for="conv in conversations"
                :key="conv.id"
                class="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-0 group flex items-start gap-2"
                :class="conversationId === conv.id ? 'bg-accent' : ''"
                @click="loadConversation(conv.id)"
              >
                <MessageSquare class="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium truncate leading-snug">{{ conv.title }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ relativeTime(conv.updated) }}</p>
                </div>
                <button
                  class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                  @click.stop="removeConversation(conv.id)"
                >
                  <Trash2 class="size-3.5" />
                </button>
              </button>
            </template>

            <p v-else class="px-3 py-6 text-xs text-muted-foreground text-center">
              No conversations yet.
            </p>
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
              <div v-else class="flex items-start gap-2">
                <div class="size-6 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full shrink-0 mt-0.5">
                  <Sparkles class="size-3" />
                </div>
                <div
                  class="max-w-[80%] bg-background border text-foreground rounded-lg px-3 py-2 text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-xs max-w-none"
                  v-html="renderMarkdown(msg.content)"
                />
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

            <div v-if="pendingProposal" class="border rounded-lg p-3 flex flex-col gap-2 bg-muted/40">
              <span class="text-sm font-semibold">{{ formatToolName(pendingProposal.tool ?? '') }}</span>
              <p class="text-sm text-muted-foreground">{{ pendingProposal.description }}</p>
              <ul v-if="proposalSummaryLines(pendingProposal.input).length" class="text-xs text-muted-foreground flex flex-col gap-0.5 pl-2 border-l-2 border-border">
                <li v-for="line in proposalSummaryLines(pendingProposal.input)" :key="line">{{ line }}</li>
              </ul>
              <div class="flex gap-2">
                <Button size="xs" :disabled="proposalLoading" @click="approveProposal">
                  <Loader2 v-if="proposalLoading" class="size-3 animate-spin mr-1" />
                  Approve
                </Button>
                <Button size="xs" variant="secondary" :disabled="proposalLoading" @click="dismissProposal">Dismiss</Button>
              </div>
            </div>

            <div ref="messagesEnd" />
          </div>

          <!-- Input area -->
          <div class="shrink-0 px-4 py-3 border-t flex flex-col gap-2">
            <!-- Active context badges -->
            <div v-if="selectedItems.length > 0" class="flex flex-wrap gap-1">
              <Badge
                v-for="item in selectedItems"
                :key="item.id"
                variant="secondary"
                class="flex items-center gap-1 pr-1"
              >
                <component :is="contextIcons[item.type]" class="size-3 shrink-0" />
                <span class="text-xs max-w-[160px] truncate">{{ item.label }}</span>
                <button
                  class="ml-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  @click="removeItem(item.id)"
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
                      <!-- Search -->
                      <div class="px-4 pt-4 pb-2 border-b shrink-0">
                        <input
                          v-model="contextSearch"
                          placeholder="Search matters, deadlines, users…"
                          class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>

                      <!-- Tabs -->
                      <Tabs v-model="contextTab" class="flex flex-col flex-1 min-h-0">
                        <TabsList class="shrink-0 px-4 py-2 justify-start gap-1 border-b bg-transparent h-auto rounded-none">
                          <TabsTrigger value="matter" class="text-xs gap-1.5">
                            <Building2 class="size-3" /> Matters
                          </TabsTrigger>
                          <TabsTrigger value="deadline" class="text-xs gap-1.5">
                            <Clock class="size-3" /> Deadlines
                          </TabsTrigger>
                          <TabsTrigger value="user" class="text-xs gap-1.5">
                            <User class="size-3" /> Users
                          </TabsTrigger>
                        </TabsList>

                        <div v-if="contextLoading" class="flex items-center justify-center p-8">
                          <Loader2 class="size-5 animate-spin text-muted-foreground" />
                        </div>

                        <template v-else>
                          <!-- Matters -->
                          <TabsContent value="matter" class="overflow-y-auto flex-1 mt-0 pb-8">
                            <template v-if="filteredMatters.length > 0">
                              <button
                                v-for="m in filteredMatters"
                                :key="m.id"
                                class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0"
                                :class="isSelected(m.id) ? 'bg-accent' : ''"
                                @click="toggleItem({ type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber })"
                              >
                                <div class="flex flex-col flex-1 min-w-0">
                                  <span class="text-sm font-medium truncate">{{ m.name }}</span>
                                  <span class="text-xs text-muted-foreground">{{ m.caseNumber }}</span>
                                </div>
                                <Check v-if="isSelected(m.id)" class="size-4 text-primary shrink-0" />
                              </button>
                            </template>
                            <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">No matters found.</p>
                          </TabsContent>

                          <!-- Deadlines -->
                          <TabsContent value="deadline" class="overflow-y-auto flex-1 mt-0 pb-8">
                            <template v-if="filteredDeadlines.length > 0">
                              <button
                                v-for="d in filteredDeadlines"
                                :key="d.id"
                                class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0"
                                :class="isSelected(d.id) ? 'bg-accent' : ''"
                                @click="toggleItem({ type: 'deadline', id: d.id, label: d.name, sublabel: d.matterName })"
                              >
                                <div class="flex flex-col flex-1 min-w-0">
                                  <span class="text-sm font-medium truncate">{{ d.name }}</span>
                                  <span class="text-xs text-muted-foreground truncate">{{ d.matterName }}</span>
                                </div>
                                <Check v-if="isSelected(d.id)" class="size-4 text-primary shrink-0" />
                              </button>
                            </template>
                            <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">No pending deadlines found.</p>
                          </TabsContent>

                          <!-- Users -->
                          <TabsContent value="user" class="overflow-y-auto flex-1 mt-0 pb-8">
                            <template v-if="filteredUsers.length > 0">
                              <button
                                v-for="u in filteredUsers"
                                :key="u.id"
                                class="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b last:border-0"
                                :class="isSelected(u.id) ? 'bg-accent' : ''"
                                @click="toggleItem({ type: 'user', id: u.id, label: u.name, sublabel: u.role })"
                              >
                                <div class="flex flex-col flex-1 min-w-0">
                                  <span class="text-sm font-medium">{{ u.name }}</span>
                                  <span v-if="u.role" class="text-xs text-muted-foreground capitalize">{{ u.role }}</span>
                                </div>
                                <Check v-if="isSelected(u.id)" class="size-4 text-primary shrink-0" />
                              </button>
                            </template>
                            <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">No users found.</p>
                          </TabsContent>
                        </template>
                      </Tabs>
                    </div>
                  </DrawerContent>
                </Drawer>
              </InputGroupAddon>

              <InputGroupTextarea
                v-model="inputText"
                placeholder="Ask, Search or Chat..."
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
                  @click="send"
                >
                  <ArrowUpIcon class="size-4" />
                  <span class="sr-only">Send</span>
                </InputGroupButton>
                <InputGroupButton variant="default" class="rounded-full" size="icon-sm" disabled>
                  <AudioLines class="size-4" />
                  <span class="sr-only">Voice</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.history-panel-enter-active,
.history-panel-leave-active {
  transition: width 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
}
.history-panel-enter-from,
.history-panel-leave-to {
  width: 0 !important;
  opacity: 0;
}
.history-panel-enter-to,
.history-panel-leave-from {
  width: 15rem; /* w-60 */
  opacity: 1;
}
</style>
