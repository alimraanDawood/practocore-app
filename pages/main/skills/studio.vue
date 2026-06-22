<script lang="ts" setup>
import { ArrowLeft, Wand2, CheckCircle2, Plus, History, Trash2, Loader2, MessageSquare } from 'lucide-vue-next';
import {
  listConversations, getConversation, deleteConversation,
  type AiConversationSummary,
} from '~/services/ai';
import { getSkill } from '~/services/skills';
import SkillStudioChat from '~/components/shared/Skills/SkillStudioChat.vue';

definePageMeta({ layout: 'default' });

const route = useRoute();
const studioRef = ref<InstanceType<typeof SkillStudioChat> | null>(null);

const conversations = ref<AiConversationSummary[]>([]);
const listLoading = ref(true);
const activeId = ref('');
const loadingId = ref('');
const savedCount = ref(0);
const mobileHistoryOpen = ref(false);

async function loadList() {
  listLoading.value = true;
  try {
    const page = await listConversations(1, 50, 'skill_studio');
    conversations.value = page?.items ?? [];
  } catch {
    conversations.value = [];
  } finally {
    listLoading.value = false;
  }
}
onMounted(async () => {
  loadList();
  // Opened with ?skill=<id> → refine that skill conversationally. Seed the chat,
  // then drop the query so a later "New skill" / refresh doesn't re-enter edit mode.
  const skillId = route.query.skill ? String(route.query.skill) : '';
  if (skillId) {
    try {
      const skill = await getSkill(skillId);
      await nextTick();
      if (skill) studioRef.value?.beginEdit(skill);
    } catch { /* fall back to a blank studio */ }
    navigateTo({ path: '/main/skills/studio' }, { replace: true });
  }
});

async function resume(id: string) {
  if (loadingId.value || id === activeId.value) { mobileHistoryOpen.value = false; return; }
  loadingId.value = id;
  try {
    const conv = await getConversation(id);
    if (conv) {
      studioRef.value?.load(conv);
      activeId.value = id;
    }
  } catch { /* ignore */ } finally {
    loadingId.value = '';
    mobileHistoryOpen.value = false;
  }
}

function newSkill() {
  studioRef.value?.reset();
  activeId.value = '';
  mobileHistoryOpen.value = false;
}

function onChanged(id: string) {
  activeId.value = id;
  // A new thread won't be in the list yet, and titles update as the chat grows.
  loadList();
}
function onSaved() { savedCount.value++; }

async function remove(id: string) {
  try {
    await deleteConversation(id);
    if (activeId.value === id) newSkill();
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
    <div class="flex items-center gap-3 px-4 sm:px-6 py-4 border-b">
      <Button variant="ghost" size="icon-sm" class="shrink-0" title="Back to skills" @click="navigateTo('/main/skills')">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="size-9 rounded-xl grid place-items-center bg-primary/10 text-primary shrink-0">
        <Wand2 class="size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="font-semibold leading-tight">Skill Studio</h1>
        <p class="text-sm text-muted-foreground truncate">
          Describe a task and I'll build a reusable skill with you — saved as a draft for your firm.
        </p>
      </div>
      <!-- Mobile history toggle -->
      <Button variant="outline" size="icon-sm" class="md:hidden shrink-0" title="In-progress builds" @click="mobileHistoryOpen = true">
        <History class="size-4" />
      </Button>
      <Button
        v-if="savedCount > 0"
        size="sm" variant="outline" class="gap-1.5 shrink-0"
        @click="navigateTo('/main/skills')"
      >
        <CheckCircle2 class="size-4 text-emerald-500" />
        View {{ savedCount === 1 ? 'skill' : 'skills' }}
      </Button>
    </div>

    <!-- Body: history rail + chat -->
    <div class="flex-1 min-h-0 flex">
      <!-- History rail (md+) -->
      <aside class="hidden md:flex w-64 shrink-0 flex-col border-r min-h-0">
        <div class="p-3">
          <Button size="sm" class="w-full gap-1.5" @click="newSkill">
            <Plus class="size-4" /> New skill
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
        <div class="mx-auto h-full max-w-3xl px-4 sm:px-6 flex flex-col min-h-0">
          <SkillStudioChat ref="studioRef" @saved="onSaved" @changed="onChanged" />
        </div>
      </div>
    </div>

    <!-- Mobile history sheet -->
    <Sheet v-model:open="mobileHistoryOpen">
      <SheetContent side="left" class="w-72 p-0 flex flex-col">
        <div class="p-3 border-b">
          <Button size="sm" class="w-full gap-1.5" @click="newSkill">
            <Plus class="size-4" /> New skill
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
