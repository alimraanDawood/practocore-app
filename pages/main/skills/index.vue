<script lang="ts" setup>
import { marked } from 'marked';
import {
  Scroll, Plus, Search, Copy, Pencil, Trash2, Check, Loader2,
  Wand2, Wrench, Lightbulb, Scale, GlobeLock, Building2,
} from 'lucide-vue-next';
import {
  listSkills, getSkill, duplicateSkill, updateSkill, deleteSkill, setSkillStatus,
  type SkillSummary, type SkillDetail, type SkillWrite,
} from '~/services/skills';

definePageMeta({ layout: 'default' });

const skills = ref<SkillSummary[]>([]);
const loading = ref(true);
const loadError = ref('');
const search = ref('');

// Detail / edit sheet.
const detailOpen = ref(false);
const detail = ref<SkillDetail | null>(null);
const detailLoading = ref(false);
const editing = ref(false);
const saving = ref(false);
const draft = reactive<SkillWrite>({});
const confirmDelete = ref(false);
const busyAction = ref('');

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    skills.value = await listSkills();
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load skills.';
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return skills.value;
  return skills.value.filter(s =>
    [s.title, s.purpose, s.triggers, s.court_scope, s.name].join(' ').toLowerCase().includes(q),
  );
});
const ownedSkills = computed(() => filtered.value.filter(s => s.owned));
const globalSkills = computed(() => filtered.value.filter(s => !s.owned));

function renderMd(text: string): string {
  try { return marked.parse(text || '', { async: false }) as string; } catch { return text; }
}

async function open(s: SkillSummary) {
  detailOpen.value = true;
  editing.value = false;
  confirmDelete.value = false;
  detail.value = null;
  detailLoading.value = true;
  try {
    detail.value = await getSkill(s.id);
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load that skill.';
    detailOpen.value = false;
  } finally {
    detailLoading.value = false;
  }
}

function startEdit() {
  if (!detail.value) return;
  Object.assign(draft, {
    title: detail.value.title,
    purpose: detail.value.purpose,
    triggers: detail.value.triggers,
    court_scope: detail.value.court_scope,
    instructions: detail.value.instructions,
    user_invocable: detail.value.user_invocable,
    status: detail.value.status,
  });
  editing.value = true;
}

async function saveEdit() {
  if (!detail.value) return;
  saving.value = true;
  try {
    detail.value = await updateSkill(detail.value.id, draft);
    editing.value = false;
    await refresh();
  } catch (e: any) {
    alert(e?.message || 'Could not save.');
  } finally {
    saving.value = false;
  }
}

async function doDuplicate(id: string) {
  busyAction.value = 'duplicate';
  try {
    const copy = await duplicateSkill(id);
    await refresh();
    detail.value = copy; // jump to the editable copy
    editing.value = false;
  } catch (e: any) {
    alert(e?.message || 'Could not duplicate.');
  } finally {
    busyAction.value = '';
  }
}

async function toggleActive() {
  if (!detail.value) return;
  busyAction.value = 'status';
  const next = detail.value.status === 'active' ? 'draft' : 'active';
  try {
    detail.value = await setSkillStatus(detail.value.id, next);
    await refresh();
  } catch (e: any) {
    alert(e?.message || 'Could not change status.');
  } finally {
    busyAction.value = '';
  }
}

async function doDelete() {
  if (!detail.value) return;
  busyAction.value = 'delete';
  try {
    await deleteSkill(detail.value.id);
    detailOpen.value = false;
    await refresh();
  } catch (e: any) {
    alert(e?.message || 'Could not delete.');
  } finally {
    busyAction.value = '';
    confirmDelete.value = false;
  }
}

const statusTone: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  deprecated: 'bg-muted text-muted-foreground',
};
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Header -->
    <div class="flex items-center gap-3 px-4 sm:px-6 py-4 border-b">
      <div class="size-9 rounded-xl grid place-items-center bg-muted text-muted-foreground shrink-0">
        <Scroll class="size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="font-semibold leading-tight">Skills</h1>
        <p class="text-sm text-muted-foreground truncate">
          Reusable procedures the assistant follows to do legal work your firm's way.
        </p>
      </div>
      <Button size="sm" class="gap-1.5 shrink-0" @click="navigateTo('/main/skills/studio')">
        <Plus class="size-4" /> Create skill
      </Button>
    </div>

    <!-- Search -->
    <div class="px-4 sm:px-6 pt-4">
      <div class="relative max-w-md">
        <Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          placeholder="Search skills…"
          class="w-full bg-muted/40 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-8">
      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading skills…
      </div>
      <div v-else-if="loadError" class="text-sm text-destructive">{{ loadError }}</div>

      <template v-else>
        <!-- Firm skills -->
        <section v-if="ownedSkills.length" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <Building2 class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-medium">Your firm's skills</h2>
            <Badge variant="secondary" class="text-[11px]">{{ ownedSkills.length }}</Badge>
          </div>
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="s in ownedSkills" :key="s.id"
              class="text-left rounded-xl border p-4 hover:border-primary/50 hover:bg-accent/40 transition-colors flex flex-col gap-2"
              @click="open(s)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium leading-tight">{{ s.title }}</p>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 capitalize" :class="statusTone[s.status] || statusTone.draft">{{ s.status }}</span>
              </div>
              <p class="text-sm text-muted-foreground line-clamp-2">{{ s.purpose }}</p>
              <div class="flex items-center gap-2 mt-auto pt-1 text-[11px] text-muted-foreground">
                <span class="flex items-center gap-1"><Wand2 class="size-3" /> Firm</span>
                <span v-if="s.court_scope" class="flex items-center gap-1 truncate"><Scale class="size-3 shrink-0" /> {{ s.court_scope }}</span>
                <span class="ml-auto">v{{ s.version }}</span>
              </div>
            </button>
          </div>
        </section>

        <!-- Global skills -->
        <section v-if="globalSkills.length" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <GlobeLock class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-medium">Standard skills</h2>
            <Badge variant="secondary" class="text-[11px]">{{ globalSkills.length }}</Badge>
          </div>
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="s in globalSkills" :key="s.id"
              class="text-left rounded-xl border p-4 hover:border-primary/50 hover:bg-accent/40 transition-colors flex flex-col gap-2"
              @click="open(s)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium leading-tight">{{ s.title }}</p>
                <Badge v-if="s.overridden" variant="outline" class="text-[10px] shrink-0">Customised</Badge>
              </div>
              <p class="text-sm text-muted-foreground line-clamp-2">{{ s.purpose }}</p>
              <div class="flex items-center gap-2 mt-auto pt-1 text-[11px] text-muted-foreground">
                <span class="flex items-center gap-1"><GlobeLock class="size-3" /> Standard</span>
                <span v-if="s.court_scope" class="flex items-center gap-1 truncate"><Scale class="size-3 shrink-0" /> {{ s.court_scope }}</span>
              </div>
            </button>
          </div>
        </section>

        <div v-if="!ownedSkills.length && !globalSkills.length" class="text-sm text-muted-foreground">
          No skills match your search.
        </div>
      </template>
    </div>

    <!-- Detail / edit sheet -->
    <Sheet v-model:open="detailOpen">
      <SheetContent side="right" class="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <div v-if="detailLoading" class="flex-1 grid place-items-center">
          <Loader2 class="size-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else-if="detail">
          <!-- Header -->
          <div class="px-5 py-4 border-b">
            <div class="flex items-center gap-2 mb-1">
              <Badge :variant="detail.owned ? 'secondary' : 'outline'" class="text-[11px] gap-1">
                <component :is="detail.owned ? Wand2 : GlobeLock" class="size-3" />
                {{ detail.owned ? 'Firm skill' : 'Standard skill' }}
              </Badge>
              <span class="text-[11px] px-1.5 py-0.5 rounded-full capitalize" :class="statusTone[detail.status] || statusTone.draft">{{ detail.status }}</span>
              <span class="text-[11px] text-muted-foreground ml-auto">v{{ detail.version }}</span>
            </div>
            <h2 v-if="!editing" class="font-semibold leading-tight">{{ detail.title }}</h2>
            <code class="text-[11px] text-muted-foreground">{{ detail.name }}</code>
          </div>

          <!-- View -->
          <div v-if="!editing" class="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            <p class="text-sm">{{ detail.purpose }}</p>

            <div v-if="detail.triggers" class="rounded-lg bg-muted/40 px-3 py-2 flex gap-2 items-start">
              <Lightbulb class="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Used when</p>
                <p class="text-sm">{{ detail.triggers }}</p>
              </div>
            </div>

            <div v-if="detail.tool_bindings?.length" class="flex flex-wrap gap-1.5">
              <Badge v-for="tool in detail.tool_bindings" :key="tool" variant="outline" class="gap-1 text-[11px]">
                <Wrench class="size-3" /> {{ tool }}
              </Badge>
            </div>

            <div>
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Instructions</p>
              <div class="prose prose-sm dark:prose-invert max-w-none text-sm" v-html="renderMd(detail.instructions)" />
            </div>
          </div>

          <!-- Edit -->
          <div v-else class="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Title</span>
              <input v-model="draft.title" class="bg-muted/40 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Purpose</span>
              <input v-model="draft.purpose" class="bg-muted/40 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Used when (triggers)</span>
              <textarea v-model="draft.triggers" rows="2" class="bg-muted/40 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Court scope (optional)</span>
              <input v-model="draft.court_scope" class="bg-muted/40 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Instructions (Markdown)</span>
              <textarea v-model="draft.instructions" rows="14" class="bg-muted/40 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary resize-y" />
            </label>
            <label class="flex items-center gap-2">
              <input v-model="draft.user_invocable" type="checkbox" class="size-4" />
              <span class="text-sm">Lawyers can run this skill explicitly</span>
            </label>
          </div>

          <!-- Footer actions -->
          <div class="border-t px-5 py-3 flex items-center flex-wrap gap-2">
            <template v-if="editing">
              <Button size="sm" :disabled="saving" class="gap-1.5" @click="saveEdit">
                <Loader2 v-if="saving" class="size-3.5 animate-spin" /><Check v-else class="size-3.5" /> Save new version
              </Button>
              <Button size="sm" variant="ghost" :disabled="saving" @click="editing = false">Cancel</Button>
            </template>

            <template v-else-if="detail.owned">
              <Button size="sm" class="gap-1.5" @click="navigateTo(`/main/skills/studio?skill=${detail.id}`)"><Wand2 class="size-3.5" /> Edit with AI</Button>
              <Button size="sm" variant="outline" class="gap-1.5" @click="startEdit"><Pencil class="size-3.5" /> Edit</Button>
              <Button size="sm" variant="outline" class="gap-1.5" :disabled="busyAction === 'status'" @click="toggleActive">
                <Loader2 v-if="busyAction === 'status'" class="size-3.5 animate-spin" />
                <Check v-else class="size-3.5" />
                {{ detail.status === 'active' ? 'Deactivate' : 'Activate' }}
              </Button>
              <Button size="sm" variant="outline" class="gap-1.5" :disabled="busyAction === 'duplicate'" @click="doDuplicate(detail.id)">
                <Copy class="size-3.5" /> Duplicate
              </Button>
              <div class="ml-auto">
                <Button v-if="!confirmDelete" size="sm" variant="ghost" class="gap-1.5 text-destructive" @click="confirmDelete = true">
                  <Trash2 class="size-3.5" /> Delete
                </Button>
                <Button v-else size="sm" variant="destructive" class="gap-1.5" :disabled="busyAction === 'delete'" @click="doDelete">
                  <Loader2 v-if="busyAction === 'delete'" class="size-3.5 animate-spin" /> Confirm delete
                </Button>
              </div>
            </template>

            <template v-else>
              <Button size="sm" class="gap-1.5" :disabled="busyAction === 'duplicate'" @click="doDuplicate(detail.id)">
                <Loader2 v-if="busyAction === 'duplicate'" class="size-3.5 animate-spin" /><Copy v-else class="size-3.5" />
                Duplicate to my firm
              </Button>
              <p class="text-[11px] text-muted-foreground">Make an editable copy — your version takes precedence for your firm.</p>
            </template>
          </div>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>
