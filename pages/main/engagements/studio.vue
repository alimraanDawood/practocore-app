<script lang="ts" setup>
import { ArrowLeft, CheckCircle2, Plus, History, Trash2, Loader2, MessageSquare, Briefcase } from 'lucide-vue-next';
import {
  listConversations, deleteConversation,
  type AiConversationSummary,
} from '~/services/ai';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';

definePageMeta({ layout: 'default' });

const chatRef = ref<InstanceType<typeof ChatSurface> | null>(null);

const conversations = ref<AiConversationSummary[]>([]);
const listLoading = ref(true);
const activeId = ref('');
const loadingId = ref('');
const savedCount = ref(0);
const mobileHistoryOpen = ref(false);

const suggestions = [
  'Build a playbook for a company incorporation with foreign shareholders.',
  'Build a playbook for reviewing and negotiating a supply contract.',
  'Build a playbook for a trademark opposition.',
];

async function loadList() {
  listLoading.value = true;
  try {
    const page = await listConversations(1, 50, 'engagement_studio');
    conversations.value = page?.items ?? [];
  } catch {
    conversations.value = [];
  } finally {
    listLoading.value = false;
  }
}

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  await loadList();
  // Deep-linked "Edit in Studio" from the playbook library: seed the chat with a
  // refine request naming the playbook, then strip the query so a refresh doesn't
  // re-fire it. The tool's upsert-by-name path updates the same playbook (or forks
  // a firm copy of a global seed).
  const editName = typeof route.query.edit === 'string' ? route.query.edit.trim() : '';
  if (editName) {
    await nextTick();
    chatRef.value?.send(
      `Let's refine my existing engagement playbook "${editName}". Load it with list_engagement_templates first, then walk me through what I'd like to change before you propose the update under the same name.`,
    );
    router.replace({ query: {} });
  }
});

async function resume(id: string) {
  if (loadingId.value || id === activeId.value) { mobileHistoryOpen.value = false; return; }
  loadingId.value = id;
  try {
    await chatRef.value?.loadConversation(id);
    activeId.value = id;
  } catch { /* ignore */ } finally {
    loadingId.value = '';
    mobileHistoryOpen.value = false;
  }
}

function newPlaybook() {
  chatRef.value?.newChat();
  activeId.value = '';
  mobileHistoryOpen.value = false;
}

function onChanged(id: string) {
  activeId.value = id;
  loadList();
}
function onSaved() { savedCount.value++; }

async function remove(id: string) {
  try {
    await deleteConversation(id);
    if (activeId.value === id) newPlaybook();
    await loadList();
  } catch { /* ignore */ }
}

function fmtWhen(s: string): string {
  const d = new Date(s);
  if (isNaN(+d)) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Header -->
    <div class="flex items-center gap-3 p-3 sm:px-6 border-b">
      <Button variant="ghost" size="icon-sm" class="shrink-0" title="Back to engagements" @click="navigateTo('/main/engagements')">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="font-semibold leading-tight ibm-plex-serif">Engagement Studio</h1>
      </div>
      <!-- Mobile history toggle -->
      <Button variant="outline" size="icon-sm" class="md:hidden shrink-0" title="In-progress builds" @click="mobileHistoryOpen = true">
        <History class="size-4" />
      </Button>
      <Button
        v-if="savedCount > 0"
        size="sm" variant="outline" class="gap-1.5 shrink-0"
        @click="navigateTo('/main/engagements')"
      >
        <CheckCircle2 class="size-4 text-emerald-500" />
        View {{ savedCount === 1 ? 'playbook' : 'playbooks' }}
      </Button>
    </div>

    <!-- Body: history rail + chat -->
    <div class="flex-1 min-h-0 flex">
      <!-- History rail (md+) -->
      <aside class="hidden md:flex w-64 shrink-0 flex-col border-r min-h-0">
        <div class="p-3">
          <Button size="sm" class="w-full gap-1.5" @click="newPlaybook">
            <Plus class="size-4" /> New playbook
          </Button>
        </div>
        <div class="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">In progress</div>
        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          <div v-if="listLoading" class="px-2 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 class="size-3.5 animate-spin" /> Loading…
          </div>
          <p v-else-if="!conversations.length" class="px-2 py-2 text-sm text-muted-foreground">
            No builds yet. Start one on the right.
          </p>
          <div
            v-for="c in conversations" :key="c.id"
            class="group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer text-sm"
            :class="c.id === activeId ? 'bg-accent' : 'hover:bg-accent/50'"
            @click="resume(c.id)"
          >
            <Loader2 v-if="loadingId === c.id" class="size-3.5 animate-spin shrink-0 text-muted-foreground" />
            <MessageSquare v-else class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="flex-1 min-w-0 truncate">{{ c.title || 'Untitled build' }}</span>
            <span class="text-[10px] text-muted-foreground shrink-0">{{ fmtWhen(c.updated) }}</span>
            <button
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
              title="Delete"
              @click.stop="remove(c.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <!-- Chat -->
      <div class="flex-1 min-h-0">
        <ChatSurface
          ref="chatRef"
          mode="engagement_studio"
          label="Engagement Studio"
          hide-toolbar
          @conversation-change="onChanged"
          @proposal-approved="onSaved"
        >
          <template #empty="{ send }">
            <div class="m-auto max-w-md text-center flex flex-col items-center gap-3 px-4">
              <div class="size-11 rounded-xl grid place-items-center bg-muted text-muted-foreground">
                <Briefcase class="size-5" />
              </div>
              <p class="font-semibold">Build an engagement playbook</p>
              <p class="text-sm text-muted-foreground">
                Describe a recurring piece of non-litigation work. I'll interview you, then draft stages,
                milestones, and a document checklist — saved as a playbook you can use for future engagements.
              </p>
              <div class="flex flex-col gap-2 w-full mt-1">
                <button
                  v-for="s in suggestions" :key="s"
                  class="text-left text-sm rounded-lg border bg-muted/50 text-muted-foreground px-3 py-2 hover:bg-muted transition-colors"
                  @click="send(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>
          </template>
        </ChatSurface>
      </div>
    </div>

    <!-- Mobile history sheet -->
    <Sheet v-model:open="mobileHistoryOpen">
      <SheetContent side="left" class="w-72 p-0 flex flex-col">
        <div class="p-3 border-b">
          <Button size="sm" class="w-full gap-1.5" @click="newPlaybook">
            <Plus class="size-4" /> New playbook
          </Button>
        </div>
        <div class="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">In progress</div>
        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          <p v-if="!conversations.length" class="px-2 py-2 text-sm text-muted-foreground">No builds yet.</p>
          <div
            v-for="c in conversations" :key="c.id"
            class="group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer text-sm"
            :class="c.id === activeId ? 'bg-accent' : 'hover:bg-accent/50'"
            @click="resume(c.id)"
          >
            <MessageSquare class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="flex-1 min-w-0 truncate">{{ c.title || 'Untitled build' }}</span>
            <button class="shrink-0 text-muted-foreground hover:text-destructive" title="Delete" @click.stop="remove(c.id)">
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
