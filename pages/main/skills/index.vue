<script lang="ts" setup>
import { marked } from 'marked';
import {
  Scroll, Plus, Search, Copy, Pencil, Trash2, Check, Loader2,
  Wand2, Wrench, Lightbulb, Scale, GlobeLock, Building2,
  Eye, Power, PowerOff, RefreshCw, X,
} from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { toast } from 'vue-sonner';
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue';
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
    toast.error(e?.message || 'Could not save.');
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
    toast.error(e?.message || 'Could not duplicate.');
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
    toast.error(e?.message || 'Could not change status.');
  } finally {
    busyAction.value = '';
  }
}

async function doDelete(target?: { id: string }) {
  const victim = target ?? detail.value;
  if (!victim) return;
  busyAction.value = 'delete';
  try {
    await deleteSkill(victim.id);
    // Close the sheet only if it was showing the skill that just went away.
    if (detail.value?.id === victim.id) detailOpen.value = false;
    deleteTarget.value = null;
    await refresh();
    toast.success('Skill deleted.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete.');
  } finally {
    busyAction.value = '';
    confirmDelete.value = false;
  }
}

// ── Right-click menus ───────────────────────────────────────────────────────
// Everything a skill can do lives in the detail sheet, which means fetching the
// whole skill before you can so much as deactivate it. The card's menu offers the
// same actions off the summary the grid already has — `editable` rides on the
// summary, so the menu gates exactly as the sheet's footer does.
//
// ONE menu for the whole body rather than one per card: a menu per card makes
// each its own dismissable layer, and right-clicking a second card leaves the
// first standing. The body clears the aim in the capture phase, a card sets it in
// the target phase, and reka re-anchors the single menu at the new point.
const coarsePointer = useMediaQuery('(pointer: coarse)');
const defer = (fn: () => void) => setTimeout(fn, 0);
const ctxSkill = ref<SkillSummary | null>(null);
const deleteTarget = ref<SkillSummary | { id: string; title: string } | null>(null);

/** Open the sheet and drop straight into its edit form. */
async function openAndEdit(sk: SkillSummary) {
  await open(sk);
  if (detail.value) startEdit();
}

/** Activate/deactivate from the grid, without opening anything. */
async function toggleActiveFor(sk: SkillSummary) {
  if (busyAction.value) return;
  busyAction.value = 'status';
  const next = sk.status === 'active' ? 'draft' : 'active';
  try {
    const updated = await setSkillStatus(sk.id, next);
    // Keep an open sheet in step when it happens to show the same skill.
    if (detail.value?.id === sk.id) detail.value = updated;
    await refresh();
    toast.success(next === 'active' ? 'Skill activated.' : 'Skill deactivated.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not change status.');
  } finally {
    busyAction.value = '';
  }
}

function cardActions(sk: SkillSummary): MenuAction[] {
  const out: MenuAction[] = [
    { id: 'open', label: 'Open', icon: Eye, run: () => defer(() => open(sk)) },
  ];

  if (sk.editable) {
    out.push({
      id: 'ai', label: 'Edit with AI', icon: Wand2, divider: true,
      run: () => navigateTo(`/main/skills/studio?skill=${sk.id}`),
    });
    out.push({ id: 'edit', label: 'Edit', icon: Pencil, run: () => defer(() => openAndEdit(sk)) });
    out.push({
      id: 'status',
      label: sk.status === 'active' ? 'Deactivate' : 'Activate',
      icon: sk.status === 'active' ? PowerOff : Power,
      disabled: busyAction.value === 'status',
      run: () => toggleActiveFor(sk),
    });
  }

  // Duplicating is the route in for everyone else — a standard skill, or a firm
  // one a colleague authored. Say which it is, as the sheet's footer does.
  out.push({
    id: 'duplicate',
    label: sk.owned ? 'Duplicate' : 'Duplicate to my firm',
    icon: Copy, divider: true,
    disabled: busyAction.value === 'duplicate',
    run: () => doDuplicate(sk.id),
  });

  if (sk.editable) {
    out.push({
      id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true,
      run: () => defer(() => { deleteTarget.value = sk; }),
    });
  }
  return out;
}

/** The menu on the page itself, rather than on any one skill. */
const surfaceActions = computed<MenuAction[]>(() => {
  const out: MenuAction[] = [
    { id: 'new', label: 'Create skill', icon: Plus, run: () => navigateTo('/main/skills/studio') },
  ];
  if (search.value.trim()) {
    out.push({ id: 'clear', label: 'Clear search', icon: X, divider: true, run: () => { search.value = ''; } });
  }
  out.push({ id: 'refresh', label: 'Refresh', icon: RefreshCw, divider: true, run: () => { refresh(); } });
  return out;
});

const statusTone: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  deprecated: 'bg-muted text-muted-foreground',
};
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Header -->
    <div class="flex items-center gap-1 p-3 border-b">
      <SidebarTrigger class="lg:hidden" />
      <div class="min-w-0 flex-1">

        <span class="font-semibold text-xl ibm-plex-serif truncate">Skills</span>
      </div>
      <Button size="sm" class="gap-1.5 shrink-0" @click="navigateTo('/main/skills/studio')">
        <Plus class="size-4" /> Create skill
      </Button>
    </div>

    <!-- Search -->
    <div class="p-3 border-b">
      <div class="relative max-w-md">
        <Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          placeholder="Search skills…"
          class="w-full bg-muted/40 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary border"
        />
      </div>
    </div>

    <!-- Body. One right-click menu for both sections: the card under the pointer
         sets the aim in the target phase, the body clears it here in the capture
         phase, so empty space gets the page's own menu. -->
    <ContextMenu>
    <ContextMenuTrigger as-child :disabled="coarsePointer">
    <div
      class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-8"
      @contextmenu.capture="ctxSkill = null">
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
              class="text-left rounded-xl border p-4  hover:bg-muted transition-colors flex flex-col gap-2"
              @click="open(s)"
              @contextmenu="ctxSkill = s"
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
              class="text-left rounded-xl border p-4 hover:bg-muted transition-colors flex flex-col gap-2"
              @click="open(s)"
              @contextmenu="ctxSkill = s"
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
    </ContextMenuTrigger>
    <ContextMenuContent class="w-56">
      <SharedActionMenuItems
        :actions="ctxSkill ? cardActions(ctxSkill) : surfaceActions"
        variant="context" />
    </ContextMenuContent>
    </ContextMenu>

    <!-- Deleting from a card's menu has no sheet to hold the two-step confirm the
         footer uses, so it gets a dialog that names what it is about to remove. -->
    <AlertDialog
      :open="!!deleteTarget"
      @update:open="(v: boolean) => { if (!v) deleteTarget = null; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{{ deleteTarget?.title }}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the skill from your firm. Anything the assistant has already
            done with it is unaffected. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="busyAction === 'delete'">Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="busyAction === 'delete'"
            @click="doDelete(deleteTarget!)">
            <Loader2 v-if="busyAction === 'delete'" class="size-4 animate-spin mr-1.5" />
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
              <span class="text-[11px] text-muted-foreground">v{{ detail.version }}</span>
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
              <div class="prose prose-pink prose-sm dark:prose-invert prose-pre:my-1 prose-code:text-xs max-w-none [&_.ai-cite]:mx-px [&_.ai-cite]:cursor-pointer [&_.ai-cite]:rounded [&_.ai-cite]:bg-secondary [&_.ai-cite]:px-1 [&_.ai-cite]:font-semibold [&_.ai-cite]:text-secondary-foreground [&_.ai-cite]:no-underline hover:[&_.ai-cite]:bg-secondary/80" v-html="renderMd(detail.instructions)" />
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

            <!-- editable, not owned: a firm skill a colleague authored is visible to
                 the whole firm but only its author (or a template manager) may change
                 it — the same rule shared playbooks have. Everyone else duplicates. -->
            <template v-else-if="detail.editable">
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
              <p class="text-[11px] text-muted-foreground">
                {{ detail.owned
                  ? 'A colleague authored this firm skill. Make your own copy, or ask them (or an administrator) to change it.'
                  : 'Make an editable copy — your version takes precedence for your firm.' }}
              </p>
            </template>
          </div>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>
