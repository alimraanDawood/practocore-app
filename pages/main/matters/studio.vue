<script lang="ts" setup>
import { ArrowLeft, CheckCircle2, Plus, History, Trash2, Loader2, MessageSquare, Scale, Wand2, ShieldCheck } from 'lucide-vue-next';
import {
  listConversations, deleteConversation,
  type AiConversationSummary,
} from '~/services/ai';
import { getTemplate } from '~/services/templates';
import type { EnhancedTemplate } from '~/lib/types/template';
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
  'Build a procedure for how we run a judicial review application.',
  'Build a procedure for taxation of costs, from filing the bill to the ruling.',
  'Build a procedure for our execution and attachment process after judgment.',
];

async function loadList() {
  listLoading.value = true;
  try {
    const page = await listConversations(1, 50, 'matter_studio');
    conversations.value = page?.items ?? [];
  } catch {
    conversations.value = [];
  } finally {
    listLoading.value = false;
  }
}

const route = useRoute();
const router = useRouter();

// ── Edit mode ────────────────────────────────────────────────────────────────
// Deep-linked "Edit in Studio" from the procedure library. The id is held here and
// sent with every turn; the backend loads the procedure and hands the assistant its
// definition. Nothing is auto-sent — Studio opens with a local greeting instead, so
// the transcript never contains words the user did not type.
const editing = ref<EnhancedTemplate | null>(null);
const editLoading = ref(false);
const editError = ref('');

// A PractoCore procedure is maintained by us and carries statutory authority, so
// it can't be edited by a firm at all — the route is to extend it. Studio says so
// up front rather than letting the user compose a change that will be refused.
const editIsSigned = computed(() => {
  const t = editing.value as (EnhancedTemplate & { provenance?: string }) | null;
  return !!t && (t.isPublic || (t.provenance ?? '') !== 'firm');
});

const editSummary = computed(() => {
  const t = editing.value;
  if (!t) return '';
  const parts: string[] = [];
  if (t.deadlineCount) parts.push(`${t.deadlineCount} step${t.deadlineCount === 1 ? '' : 's'}`);
  if (t.fieldCount) parts.push(`${t.fieldCount} field${t.fieldCount === 1 ? '' : 's'}`);
  return parts.length ? `It has ${parts.join(' and ')}.` : '';
});

const editSuggestions = computed(() => editIsSigned.value
  ? [
      'Add our own internal steps on top of this procedure',
      'What does this procedure already cover?',
    ]
  : [
      'Add a step to this procedure',
      'Change when a step falls',
      'Change how we count weekends and holidays',
    ]);

async function loadEditTarget(id: string) {
  editLoading.value = true;
  editError.value = '';
  try {
    editing.value = await getTemplate(id);
  } catch {
    // A stale or unreachable id degrades to plain authoring rather than a dead
    // page: the backend independently refuses an id it can't resolve.
    editing.value = null;
    editError.value = 'That procedure could not be loaded. You can still build a new one here.';
  } finally {
    editLoading.value = false;
  }
}

onMounted(async () => {
  await loadList();
  const templateId = typeof route.query.template === 'string' ? route.query.template.trim() : '';
  if (templateId) {
    await loadEditTarget(templateId);
    // Strip the query so a refresh doesn't re-enter edit mode over a thread that
    // has since moved on. The id lives in `editing` from here.
    router.replace({ query: {} });
  }
});

function clearEditing() {
  editing.value = null;
  editError.value = '';
}

async function resume(id: string) {
  if (loadingId.value || id === activeId.value) { mobileHistoryOpen.value = false; return; }
  loadingId.value = id;
  try {
    await chatRef.value?.loadConversation(id);
    activeId.value = id;
    // A resumed thread is its own conversation — don't keep amending the
    // procedure the user happened to arrive with.
    clearEditing();
  } catch { /* ignore */ } finally {
    loadingId.value = '';
    mobileHistoryOpen.value = false;
  }
}

function newProcedure() {
  chatRef.value?.newChat();
  activeId.value = '';
  mobileHistoryOpen.value = false;
  clearEditing();
}

function onChanged(id: string) {
  activeId.value = id;
  loadList();
}
function onSaved() { savedCount.value++; }

async function remove(id: string) {
  try {
    await deleteConversation(id);
    if (activeId.value === id) newProcedure();
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
      <Button variant="ghost" size="icon-sm" class="shrink-0" title="Back to litigation" @click="navigateTo('/main/matters')">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="font-semibold leading-tight ibm-plex-serif">Matter Studio</h1>
        <p v-if="editing" class="text-xs text-muted-foreground truncate">
          {{ editIsSigned ? 'Viewing' : 'Editing' }} <span class="font-medium text-foreground">{{ editing.name }}</span>
        </p>
      </div>
      <!-- Mobile history toggle -->
      <Button variant="outline" size="icon-sm" class="md:hidden shrink-0" title="In-progress builds" @click="mobileHistoryOpen = true">
        <History class="size-4" />
      </Button>
      <Button
        v-if="savedCount > 0"
        size="sm" variant="outline" class="gap-1.5 shrink-0"
        @click="navigateTo('/main/matters/create')"
      >
        <CheckCircle2 class="size-4 text-emerald-500" />
        Start a matter
      </Button>
    </div>

    <!-- Body: history rail + chat -->
    <div class="flex-1 min-h-0 flex">
      <!-- History rail (md+) -->
      <aside class="hidden md:flex w-64 shrink-0 flex-col border-r min-h-0">
        <div class="p-3">
          <Button size="sm" class="w-full gap-1.5" @click="newProcedure">
            <Plus class="size-4" /> New procedure
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
          mode="matter_studio"
          label="Matter Studio"
          hide-toolbar
          :edit-template-id="editing?.id ?? ''"
          @conversation-change="onChanged"
          @proposal-approved="onSaved"
        >
          <template #empty="{ send }">
            <div v-if="editLoading" class="m-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 class="size-4 animate-spin" /> Loading procedure…
            </div>

            <!-- Edit mode opener. Rendered locally rather than sent as a turn: the
                 assistant already receives the procedure's definition with every
                 message, so this greeting is instant, free, and cannot be wrong. -->
            <div v-else-if="editing" class="m-auto max-w-md text-center flex flex-col items-center gap-3 px-4">
              <div class="size-11 rounded-xl grid place-items-center"
                :class="editIsSigned ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'">
                <component :is="editIsSigned ? ShieldCheck : Wand2" class="size-5" />
              </div>
              <p class="font-semibold">
                {{ editIsSigned ? '“' + editing.name + '”' : 'Editing “' + editing.name + '”' }}
              </p>
              <p v-if="editIsSigned" class="text-sm text-muted-foreground">
                This procedure is maintained by PractoCore — its deadlines carry statutory authority, so it
                can't be edited by a firm. I can build your firm's own procedure that adds your internal steps
                on top of it, which keeps the statutory dates ours to maintain.
              </p>
              <p v-else class="text-sm text-muted-foreground">
                {{ editSummary }} Tell me what you'd like to change and I'll propose the update for you to review.
              </p>
              <div class="flex flex-col gap-2 w-full mt-1">
                <button
                  v-for="s in editSuggestions" :key="s"
                  class="text-left text-sm rounded-lg border bg-muted/50 text-muted-foreground px-3 py-2 hover:bg-muted transition-colors"
                  @click="send(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>

            <div v-else class="m-auto max-w-md text-center flex flex-col items-center gap-3 px-4">
              <div class="size-11 rounded-xl grid place-items-center bg-muted text-muted-foreground">
                <Scale class="size-5" />
              </div>
              <p class="font-semibold">Build a litigation procedure</p>
              <p class="text-sm text-muted-foreground">
                Describe how your firm runs a kind of case. I'll interview you, then draft the trigger date,
                the key events, and each dated step — saved as a procedure you can start matters from.
              </p>
              <p class="text-xs text-muted-foreground border-t border-border/60 pt-3 w-full">
                This builds <b>your firm's</b> procedure. It sits alongside PractoCore's own, which carry the
                statutory deadlines and their authority — a procedure you author here never states what the
                law requires.
              </p>
              <p v-if="editError" class="text-xs text-destructive">{{ editError }}</p>
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
          <Button size="sm" class="w-full gap-1.5" @click="newProcedure">
            <Plus class="size-4" /> New procedure
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
