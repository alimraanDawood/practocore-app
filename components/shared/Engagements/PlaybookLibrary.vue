<script lang="ts" setup>
import {
  Loader2, Wand2, Copy, Trash2, ChevronDown, ChevronRight, Layers,
  CalendarClock, FileText, Milestone, Lock, Users, Globe, Plus, Bell, BellOff,
  History, RotateCcw, Settings2, ArrowRight,
} from 'lucide-vue-next';
import {
  listEngagementTemplates, duplicateEngagementTemplate, deleteEngagementTemplate,
  canManageTemplate, describeCompliance,
  listTemplateVersions, restoreTemplateVersion,
  type EngagementTemplate, type EngagementTemplateVersion,
} from '~/services/engagements';
import { pb } from '~/lib/pocketbase';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ changed: []; use: [templateId: string] }>();

const router = useRouter();
const { hasPermission } = usePermissions();

// Mirrors the backend gate in propose_engagement_template: a firm playbook you did
// not author needs canManageTemplates (admins and solo users pass automatically via
// hasPermission). Shown here so the wand is disabled up front rather than letting a
// lawyer compose a change that is refused on save. The backend remains the boundary.
function canEditTemplate(t: EngagementTemplate): boolean {
  if (t.isPublic) return true; // editing a starter forks an owned copy — always allowed
  if (!t.organisation) return true; // personal: only the author can see it at all
  return t.author === pb.authStore.record?.id || hasPermission('canManageTemplates');
}

const templates = ref<EngagementTemplate[]>([]);
const loading = ref(false);
const error = ref('');
const expandedId = ref('');
const busyId = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    templates.value = await listEngagementTemplates();
  } catch (e: any) {
    error.value = e?.message || 'Could not load playbooks.';
  } finally {
    loading.value = false;
  }
}

watch(open, (v) => { if (v) load(); });

// Split into the firm's/own editable playbooks vs. the read-only starter library.
const mine = computed(() => templates.value.filter((t) => !t.isPublic));
const starters = computed(() => templates.value.filter((t) => t.isPublic));
const groups = computed(() => [
  { key: 'mine', label: 'Your playbooks', items: mine.value, empty: 'None yet. Build one in Studio, or duplicate a starter below.' },
  { key: 'starters', label: 'Starter library', items: starters.value, empty: '' },
]);

function scopeOf(t: EngagementTemplate): { icon: any; text: string } {
  if (t.isPublic) return { icon: Globe, text: 'Starter' };
  if (t.organisation) return { icon: Users, text: 'Firm' };
  return { icon: Lock, text: 'Personal' };
}

function fieldLabels(t: EngagementTemplate): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of t.data?.sections ?? []) for (const f of s.fields ?? []) m[f.id] = f.label;
  return m;
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? '' : id;
}

// Edit routes through Studio, carrying the playbook's ID — not its name. Studio
// loads the record and hands the assistant its exact definition, so editing an
// own/firm playbook updates that record in place (rename included) and editing a
// starter forks an owned override. Passing a name instead made the assistant hunt
// for the playbook by fuzzy match, and a rename mid-edit created a duplicate.
function editInStudio(id: string) {
  open.value = false;
  router.push({ path: '/main/engagements/studio', query: id ? { template: id } : {} });
}

async function duplicate(t: EngagementTemplate) {
  busyId.value = t.id;
  try {
    await duplicateEngagementTemplate(t);
    await load();
    emit('changed');
  } catch (e: any) {
    error.value = e?.message || 'Could not duplicate.';
  } finally {
    busyId.value = '';
  }
}

// ── Manage menu ──────────────────────────────────────────────────────────────
// The per-row actions (edit / history / duplicate / delete) used to sit as four
// bare icon buttons in the header, which on a phone left the name two words wide
// and gave no hint what any glyph did. They now live behind one Manage control —
// a Drawer on mobile, a Popover anchored to the button on desktop — so the row
// carries just the two things you actually reach for: manage, or use.
const manageFor = ref<EngagementTemplate | null>(null);
// One markup definition for the action list, reused by both shells.
const [DefineManageList, ReuseManageList] = createReusableTemplate<{ template: EngagementTemplate }>();

interface ManageAction {
  key: string;
  label: string;
  hint?: string;
  icon: any;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

function manageActions(t: EngagementTemplate): ManageAction[] {
  const editable = canEditTemplate(t);
  const actions: ManageAction[] = [
    {
      key: 'edit',
      label: 'Edit in Studio',
      hint: !editable
        ? 'A colleague authored this firm playbook — duplicate it, or ask an administrator for the manage-templates permission'
        : t.isPublic ? 'Creates your own copy to change' : 'Change stages, milestones and documents',
      icon: Wand2,
      disabled: !editable,
      run: () => editInStudio(t.id),
    },
  ];
  if (!t.isPublic) {
    actions.push({
      key: 'history',
      label: 'Version history',
      hint: 'Review earlier revisions and restore one',
      icon: History,
      run: () => openHistory(t),
    });
  }
  actions.push({
    key: 'duplicate',
    label: 'Duplicate',
    hint: 'Make an editable copy of your own',
    icon: Copy,
    disabled: busyId.value === t.id,
    run: () => duplicate(t),
  });
  if (canManageTemplate(t)) {
    actions.push({
      key: 'delete',
      label: 'Delete',
      hint: "Engagements already created from it aren't affected",
      icon: Trash2,
      danger: true,
      run: () => { deleteTarget.value = t; },
    });
  }
  return actions;
}

function runManageAction(a: ManageAction) {
  if (a.disabled) return;
  manageFor.value = null;
  a.run();
}

// Starting work from a playbook hands the id up to the page, which opens the
// create flow with it already picked — the library itself closes, since the
// create Dialog/Drawer would otherwise stack on top of this Sheet.
function useTemplate(t: EngagementTemplate) {
  open.value = false;
  emit('use', t.id);
}

// ── Version history ──────────────────────────────────────────────────────────
// Editing a playbook rewrites it wholesale, so history is what makes editing safe
// to attempt. Loaded lazily — only when someone actually opens it.
const historyFor = ref<EngagementTemplate | null>(null);
const versions = ref<EngagementTemplateVersion[]>([]);
const versionsLoading = ref(false);
const restoringId = ref('');

async function openHistory(t: EngagementTemplate) {
  historyFor.value = t;
  versions.value = [];
  versionsLoading.value = true;
  try {
    versions.value = await listTemplateVersions(t.id);
  } catch (e: any) {
    error.value = e?.message || 'Could not load history.';
    historyFor.value = null;
  } finally {
    versionsLoading.value = false;
  }
}

async function restore(v: EngagementTemplateVersion) {
  if (!historyFor.value || restoringId.value) return;
  restoringId.value = v.id;
  try {
    await restoreTemplateVersion(historyFor.value.id, v.id);
    historyFor.value = null;
    await load();
    emit('changed');
  } catch (e: any) {
    error.value = e?.message || 'Could not restore that revision.';
  } finally {
    restoringId.value = '';
  }
}

function fmtWhen(s: string): string {
  const d = new Date(s);
  if (isNaN(+d)) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const deleteTarget = ref<EngagementTemplate | null>(null);
const deleting = ref(false);
async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteEngagementTemplate(deleteTarget.value.id);
    deleteTarget.value = null;
    await load();
    emit('changed');
  } catch (e: any) {
    error.value = e?.message || 'Could not delete.';
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <!-- Shared body for the manage Popover (desktop) and Drawer (mobile). -->
  <DefineManageList v-slot="{ template: t }">
    <div class="flex flex-col">
      <button
        v-for="a in manageActions(t)" :key="a.key"
        type="button"
        class="flex items-start gap-2.5 rounded-md p-2 text-left transition-colors disabled:opacity-50 disabled:pointer-events-none"
        :class="a.danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-muted'"
        :disabled="a.disabled"
        @click="runManageAction(a)"
      >
        <component :is="a.icon" class="mt-0.5 size-4 shrink-0" />
        <span class="min-w-0">
          <span class="block text-sm">{{ a.label }}</span>
          <span v-if="a.hint" class="block text-[11px] leading-snug text-muted-foreground">{{ a.hint }}</span>
        </span>
      </button>
    </div>
  </DefineManageList>

  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg p-0 flex flex-col">
      <SheetHeader class="p-4 border-b">
        <SheetTitle class="flex items-center gap-2"><Layers class="size-4" /> Playbooks</SheetTitle>
        <SheetDescription>
          View, edit, duplicate, and delete the engagement playbooks your work is built from.
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        <Button variant="outline" class="gap-1.5 w-full" @click="editInStudio('')">
          <Plus class="size-4" /> Build a new playbook in Studio
        </Button>

        <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 class="size-4 animate-spin" /> Loading…
        </div>
        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

        <template v-else>
          <section v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
            <h3 class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ g.label }}</h3>
            <p v-if="!g.items.length && g.empty" class="text-sm text-muted-foreground">{{ g.empty }}</p>

            <div v-for="t in g.items" :key="t.id" class="rounded-lg border bg-muted/40">
              <!-- Header row -->
              <div class="flex items-start gap-2 p-3">
                <button class="mt-0.5 shrink-0 text-muted-foreground" @click="toggle(t.id)">
                  <component :is="expandedId === t.id ? ChevronDown : ChevronRight" class="size-4" />
                </button>
                <div class="min-w-0 flex-1 cursor-pointer" @click="toggle(t.id)">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ t.name }}</span>
                    <Badge variant="outline" class="gap-1 text-[10px]">
                      <component :is="scopeOf(t).icon" class="size-2.5" /> {{ scopeOf(t).text }}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground line-clamp-2 mt-0.5">{{ t.description }}</p>
                  <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span class="flex items-center gap-1">
                      <Layers class="size-3" />
                      {{ t.data?.stages?.length ? `${t.data.stages.length} stages` : 'Lightweight' }}
                    </span>
                    <span v-if="t.data?.milestones?.length" class="flex items-center gap-1">
                      <Milestone class="size-3" /> {{ t.data.milestones.length }}
                    </span>
                    <span v-if="t.data?.compliance?.length" class="flex items-center gap-1">
                      <CalendarClock class="size-3" /> {{ t.data.compliance.length }}
                    </span>
                    <span v-if="t.data?.documents?.length" class="flex items-center gap-1">
                      <FileText class="size-3" /> {{ t.data.documents.length }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <!-- Desktop: the manage menu hangs off the button as a Popover.
                       Mobile falls through to the shared Drawer below. -->
                  <Popover
                    v-if="$viewport.isGreaterOrEquals('customxs')"
                    :open="manageFor?.id === t.id"
                    @update:open="(v) => { manageFor = v ? t : null; }"
                  >
                    <PopoverTrigger as-child>
                      <Button size="icon-sm" variant="ghost" title="Manage playbook">
                        <Settings2 class="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" class="w-64 p-1">
                      <ReuseManageList :template="t" />
                    </PopoverContent>
                  </Popover>
                  <Button
                    v-else
                    size="icon-sm" variant="ghost" title="Manage playbook"
                    @click="manageFor = t"
                  >
                    <Settings2 class="size-3.5" />
                  </Button>

                  <Button
                    size="sm" variant="secondary" class="h-7 gap-1 px-2 text-xs"
                    title="Start an engagement from this playbook"
                    @click="useTemplate(t)"
                  >
                    Use <ArrowRight class="size-3" />
                  </Button>
                </div>
              </div>

              <!-- Expanded detail -->
              <div v-if="expandedId === t.id" class="border-t px-3 py-3 flex flex-col gap-3 text-xs">
                <div v-if="t.data?.stages?.length" class="flex items-center gap-1.5 flex-wrap">
                  <template v-for="(s, i) in t.data.stages" :key="s.id">
                    <span class="rounded-full bg-muted px-2 py-0.5">{{ s.label }}</span>
                    <ChevronRight v-if="i < t.data.stages.length - 1" class="size-3 text-muted-foreground" />
                  </template>
                </div>

                <div v-if="t.data?.milestones?.length">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Milestones</p>
                  <ul class="flex flex-col gap-1">
                    <li v-for="m in t.data.milestones" :key="m.id" class="flex items-center gap-1.5">
                      <component :is="m.reminder ? Bell : BellOff" class="size-3 shrink-0"
                        :class="m.reminder ? 'text-primary' : 'text-muted-foreground'" />
                      <span>{{ m.label }}</span>
                    </li>
                  </ul>
                </div>

                <div v-if="t.data?.compliance?.length">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Recurring obligations</p>
                  <ul class="flex flex-col gap-1">
                    <li v-for="c in t.data.compliance" :key="c.id">
                      <span class="font-medium">{{ c.label }}</span>
                      <span class="text-muted-foreground"> — {{ describeCompliance(c, fieldLabels(t)) }}</span>
                    </li>
                  </ul>
                </div>

                <div v-if="t.data?.documents?.length" class="flex items-center gap-1.5 flex-wrap">
                  <Badge v-for="d in t.data.documents" :key="d.id" variant="outline" class="text-[10px]">
                    {{ d.label }}<span v-if="d.optional" class="text-muted-foreground"> (optional)</span>
                  </Badge>
                </div>
              </div>
            </div>
          </section>
        </template>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Version history. A nested reka-ui Sheet over the library Sheet — supported,
       since both share one dismissable-layer stack (see CLAUDE.md on nesting). -->
  <Sheet :open="!!historyFor" @update:open="(v) => { if (!v) historyFor = null; }">
    <SheetContent side="right" class="w-full sm:max-w-md p-0 flex flex-col">
      <SheetHeader class="p-4 border-b">
        <SheetTitle class="flex items-center gap-2"><History class="size-4" /> History</SheetTitle>
        <SheetDescription class="truncate">{{ historyFor?.name }}</SheetDescription>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2">
        <div v-if="versionsLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" /> Loading…
        </div>
        <p v-else-if="!versions.length" class="text-sm text-muted-foreground">
          No revisions recorded yet. Every save from here on is kept.
        </p>

        <div
          v-for="(v, i) in versions" :key="v.id"
          class="rounded-lg border bg-muted/40 p-3 flex items-start gap-2"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-sm">Revision {{ v.seq }}</span>
              <Badge v-if="i === 0" variant="outline" class="text-[10px]">Current</Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ v.name }}</p>
            <p class="text-[11px] text-muted-foreground mt-1">
              {{ fmtWhen(v.created) }}<span v-if="v.authorName"> · {{ v.authorName }}</span>
            </p>
            <p v-if="v.note" class="text-[11px] text-muted-foreground italic mt-0.5">{{ v.note }}</p>
          </div>
          <Button
            v-if="i > 0"
            size="sm" variant="outline" class="gap-1.5 shrink-0"
            :disabled="!!restoringId"
            title="Make this the current version"
            @click="restore(v)"
          >
            <Loader2 v-if="restoringId === v.id" class="size-3.5 animate-spin" />
            <RotateCcw v-else class="size-3.5" />
            Restore
          </Button>
        </div>

        <p v-if="versions.length" class="text-[11px] text-muted-foreground mt-2 border-t pt-3">
          Restoring keeps the current version in this list, so it can be undone.
          Engagements already created from this playbook are unaffected either way.
        </p>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Mobile: the same actions as a bottom Drawer. Desktop uses the per-row
       Popover above, so this only mounts on small viewports. -->
  <Drawer
    v-if="!$viewport.isGreaterOrEquals('customxs')"
    :open="!!manageFor" @update:open="(v) => { if (!v) manageFor = null; }"
  >
    <DrawerContent>
      <DrawerHeader class="text-left">
        <DrawerTitle class="text-base">Manage playbook</DrawerTitle>
        <DrawerDescription class="truncate">{{ manageFor?.name }}</DrawerDescription>
      </DrawerHeader>
      <div class="px-3 pb-6">
        <ReuseManageList v-if="manageFor" :template="manageFor" />
      </div>
    </DrawerContent>
  </Drawer>

  <AlertDialog :open="!!deleteTarget" @update:open="(v) => { if (!v) deleteTarget = null; }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{{ deleteTarget?.name }}"?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the playbook. Engagements already created from it are unaffected. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
        <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
          <Loader2 v-if="deleting" class="size-4 animate-spin mr-1.5" /> Delete
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
