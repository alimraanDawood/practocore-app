<script lang="ts" setup>
// The litigation counterpart to <SharedEngagementsPlaybookLibrary>: the shelf a
// lawyer opens to see what their matters are actually built on. "Procedure" is
// the product's own word for these — see TemplateSelector, and the date_change
// proposal card ("the date the matter's procedure computes").
//
// Stewardship (edit, duplicate, version history, delete) lives behind the per-row
// Manage control, mirroring <SharedEngagementsPlaybookLibrary>. What a given row
// offers depends on who authored it: a PractoCore procedure carries statutory
// authority and cannot be edited, restored or deleted by a firm at all — the only
// route into one is extending it in Studio, which keeps the statutory dates ours
// to maintain.
import {
  CalendarClock, ChevronDown, ChevronRight, Building2, Layers, ListChecks,
  Loader2, Scale, Search, ShieldCheck, Wand2, ArrowRight, Settings2, CornerUpLeft,
  Copy, History, RotateCcw, Trash2,
} from 'lucide-vue-next';
import type { RecordModel } from 'pocketbase';
import {
  getAllTemplates, canManageProcedure, duplicateTemplate, deleteTemplate,
  listProcedureVersions, restoreProcedureVersion, type ProcedureVersion,
} from '~/services/templates';
import type { EnhancedTemplate } from '~/lib/types/template';
import { normalizeTemplateRecord } from '~/utils/normalizeTemplate';
import CreateMatterDialog from '~/components/shared/Matters/CreateMatterDialog.vue';

const open = defineModel<boolean>('open', { default: false });

const router = useRouter();
const { hasPermission } = usePermissions();

// Mirrors the backend gate: the author always, plus a canManageTemplates steward
// in the same firm — the permission migration 1784030000 exists so a firm's
// library outlives the associate who wrote it. Resolved here so an action is
// disabled up front rather than refused on save. The backend remains the boundary.
function canManage(t: EnhancedTemplate): boolean {
  return canManageProcedure(t as any, hasPermission('canManageTemplates'));
}

// Matter Studio is where a litigation procedure is composed, the way Engagement
// Studio is for playbooks. Close the sheet first so a back navigation does not
// land behind it.
function openStudio() {
  open.value = false;
  router.push('/main/matters/studio');
}

const templates = ref<EnhancedTemplate[]>([]);
const loading = ref(false);
const error = ref('');
const query = ref('');
const expandedId = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    templates.value = await getAllTemplates();
  } catch (e: any) {
    error.value = e?.message || 'Could not load procedures.';
  } finally {
    loading.value = false;
  }
}
watch(open, (v) => { if (v) load(); });

// ── Start a matter from a procedure ─────────────────────────────────────────
// Hands the chosen procedure to the create flow, which then opens on the
// timeline step — the picker has nothing left to ask.
const createOpen = ref(false);
const chosen = ref<any>(null);

function useProcedure(t: EnhancedTemplate) {
  // Normalise before handing it over, exactly as the picker does: a firm
  // procedure that extends a PractoCore one carries only its own additions, and
  // the create form needs the base's trigger prompt and intake fields too.
  chosen.value = normalizeTemplateRecord(t, templates.value);
  open.value = false;
  // Let the Sheet finish its exit animation first: opening a second overlay while
  // the first is still unmounting fights over the body scroll lock.
  setTimeout(() => { createOpen.value = true; }, 200);
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? '' : id;
}

// ── Manage menu ─────────────────────────────────────────────────────────────
// Mirrors <SharedEngagementsPlaybookLibrary>: one Manage control per row —
// a Popover anchored to the button on desktop, a Drawer on mobile — so the row
// carries just manage or use. What a row offers depends on who authored it: a
// signed procedure gets Extend alone, a firm one gets the full set.
const manageFor = ref<EnhancedTemplate | null>(null);
const [DefineManageList, ReuseManageList] = createReusableTemplate<{ template: EnhancedTemplate }>();

interface ManageAction {
  key: string;
  label: string;
  hint?: string;
  icon: any;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

// The id of the PractoCore procedure a firm one extends, when it resolves to a
// procedure actually on this shelf (baseNameOf falls back to prose when it
// doesn't, which is nothing to navigate to).
function baseIdOf(t: EnhancedTemplate): string {
  const id = blobOf(t)?.extends?.templateId;
  return id && templates.value.some((x) => x.id === id) ? id : '';
}

function editInStudio(t: EnhancedTemplate) {
  open.value = false;
  router.push({ path: '/main/matters/studio', query: { template: t.id } });
}

// Reveals the base in place rather than navigating: the shelf already lists it.
// The search is cleared first — a query narrow enough to surface the extending
// procedure will usually have filtered the base out, and scrolling to a row that
// isn't rendered looks like the action did nothing.
function showBase(id: string) {
  query.value = '';
  expandedId.value = id;
  nextTick(() => {
    document.getElementById(`procedure-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function manageActions(t: EnhancedTemplate): ManageAction[] {
  const signed = !isFirmAuthored(t as any);
  const mine = canManage(t);
  const actions: ManageAction[] = [
    signed
      ? {
          key: 'extend',
          label: 'Extend in Matter Studio',
          hint: "PractoCore maintains this one, so it can't be edited directly — Studio builds your firm's own on top of it",
          icon: Wand2,
          run: () => editInStudio(t),
        }
      : {
          key: 'edit',
          label: 'Edit in Matter Studio',
          hint: mine
            ? 'Change the trigger date, steps and intake fields'
            : 'A colleague authored this — ask an administrator for the manage-templates permission',
          icon: Wand2,
          disabled: !mine,
          run: () => editInStudio(t),
        },
  ];

  // Both kinds keep history. A firm's is its own editing story; a signed one's is
  // PractoCore's published revisions — a firm needs to see that the statutory
  // procedure it relies on changed under it. Only the firm's is restorable, which
  // the history panel reflects and the backend enforces.
  actions.push({
    key: 'history',
    label: 'Version history',
    hint: signed
      ? "PractoCore's published revisions of this procedure"
      : 'Review earlier revisions and restore one',
    icon: History,
    run: () => openHistory(t),
  });

  // A signed procedure cannot be copied — a firm-provenance record holding our
  // statutory deadlines is what the provenance gate refuses. Duplicating one
  // therefore produces an EXTENSION of it instead: same timeline, statutory spine
  // still ours to maintain, the firm's own steps added on top.
  actions.push({
    key: 'duplicate',
    label: signed ? "Create your firm's version" : 'Duplicate',
    hint: signed
      ? 'Builds on this one, so our updates to the statutory dates still reach you'
      : 'Make an editable copy of your own',
    icon: Copy,
    disabled: busyId.value === t.id,
    run: () => duplicate(t),
  });

  const baseId = baseIdOf(t);
  if (baseId) {
    actions.push({
      key: 'base',
      label: 'Show the procedure it extends',
      hint: baseNameOf(t),
      icon: CornerUpLeft,
      run: () => showBase(baseId),
    });
  }

  if (mine) {
    actions.push({
      key: 'delete',
      label: 'Delete',
      hint: "Matters already built on it keep their timelines",
      icon: Trash2,
      danger: true,
      run: () => { deleteTarget.value = t; },
    });
  }
  return actions;
}

// A PractoCore procedure has exactly one thing a firm can do to it — extend it.
// The rest are not hidden, they do not exist: the provenance gate refuses a
// firm-authored copy of statutory deadlines, the delete rule refuses the delete,
// and history is not kept for procedures we reconcile ourselves. The Manage
// control still opens for those rows: one consistent place to look beats a row
// whose affordance changes shape depending on who authored the procedure.
// Built once per load rather than per binding: the row template asks for a
// procedure's actions three or four times (the button, its icon, its tooltip).
const rowActions = computed<Record<string, ManageAction[]>>(() =>
  Object.fromEntries(templates.value.map((t) => [t.id, manageActions(t)])));

function actionsFor(t: EnhancedTemplate): ManageAction[] {
  return rowActions.value[t.id] ?? manageActions(t);
}


function runManageAction(a: ManageAction) {
  if (a.disabled) return;
  manageFor.value = null;
  a.run();
}

// ── Duplicate / delete ──────────────────────────────────────────────────────
const busyId = ref('');

async function duplicate(t: EnhancedTemplate) {
  busyId.value = t.id;
  try {
    await duplicateTemplate(t as any);
    await load();
  } catch (e: any) {
    error.value = e?.message || 'Could not duplicate.';
  } finally {
    busyId.value = '';
  }
}

const deleteTarget = ref<EnhancedTemplate | null>(null);
const deleting = ref(false);

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteTemplate(deleteTarget.value.id);
    deleteTarget.value = null;
    await load();
  } catch (e: any) {
    error.value = e?.message || 'Could not delete.';
  } finally {
    deleting.value = false;
  }
}

// ── Version history ─────────────────────────────────────────────────────────
// Editing a procedure rewrites it wholesale, so history is what makes editing
// safe to attempt. Loaded lazily — only when someone actually opens it.
const historyFor = ref<EnhancedTemplate | null>(null);
const versions = ref<ProcedureVersion[]>([]);
const versionsLoading = ref(false);
const restoringId = ref('');

async function openHistory(t: EnhancedTemplate) {
  historyFor.value = t;
  versions.value = [];
  versionsLoading.value = true;
  try {
    versions.value = await listProcedureVersions(t.id);
  } catch (e: any) {
    error.value = e?.message || 'Could not load history.';
    historyFor.value = null;
  } finally {
    versionsLoading.value = false;
  }
}

// A signed procedure's history is readable but not restorable: writing an old
// revision back would rewrite a procedure carrying statutory authority, for every
// firm using it. The backend refuses it; this keeps the button from being offered.
const historyRestorable = computed(() => !!historyFor.value && canManage(historyFor.value));

async function restore(v: ProcedureVersion) {
  if (!historyFor.value || restoringId.value) return;
  restoringId.value = v.id;
  try {
    await restoreProcedureVersion(historyFor.value.id, v.id);
    historyFor.value = null;
    await load();
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

// Same test the create flow uses, so the two surfaces never disagree about
// which procedures carry PractoCore's authority.
const isFirmAuthored = (t: RecordModel) => t.provenance === 'firm';

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter((t) =>
    `${t.name} ${t.description ?? ''} ${t.matterType ?? ''} ${t.courtLevel ?? ''}`.toLowerCase().includes(q),
  );
});

const groups = computed(() => [
  {
    key: 'signed',
    label: 'PractoCore procedures',
    hint: 'Maintained by PractoCore against the rules of court.',
    items: filtered.value.filter((t) => !isFirmAuthored(t)),
    empty: 'None available.',
  },
  {
    key: 'firm',
    label: "Your firm's procedures",
    hint: 'Authored here. The timelines they produce are your firm\'s process, not a signed one.',
    items: filtered.value.filter(isFirmAuthored),
    empty: 'None yet.',
  },
]);

// A firm procedure may extend a signed one. The pointer lives in the stored blob
// rather than a column, so this reads the same JSON the engine composes from.
function baseNameOf(t: EnhancedTemplate): string {
  try {
    const raw = typeof t.template === 'string' ? JSON.parse(t.template) : t.template;
    const id = raw?.extends?.templateId;
    if (!id) return '';
    return templates.value.find((x) => x.id === id)?.name ?? 'a PractoCore procedure';
  } catch {
    return '';
  }
}

function blobOf(t: EnhancedTemplate): any {
  try {
    return typeof t.template === 'string' ? JSON.parse(t.template) : (t.template ?? {});
  } catch {
    return {};
  }
}

// Two template schemas are live at once: the legacy blob keeps deadlines at the
// top level, the v2 engine wraps them in a TemplateIR. `enhanceTemplate` only
// reads the legacy path, which is why deadlineCount is 0 on every v2 record —
// so resolve the shape here rather than trusting that count.
function irOf(t: EnhancedTemplate): any {
  const b = blobOf(t);
  if (Array.isArray(b?.deadlines)) return b;
  return b?.ir ?? b?.data ?? b?.template ?? b ?? {};
}

function deadlinesOf(t: EnhancedTemplate): any[] {
  const ir = irOf(t);
  return Array.isArray(ir?.deadlines) ? ir.deadlines : [];
}

// The v2 IR describes the start as a trigger spec; the legacy blob as a prompt.
function triggerLabelOf(t: EnhancedTemplate): string {
  const ir = irOf(t);
  return ir?.triggerDatePrompt || ir?.trigger?.prompt || ir?.trigger?.label || ir?.trigger?.name || '';
}

// "14 days after the trigger date" — the deadline's own words, so the shelf
// shows what the procedure will actually compute rather than a bare count.
function describeDeadline(d: any, all: any[] = []): string {
  // Legacy: { type:'offset', offset:{days, offsetId} }.
  // v2 IR:  { kind:'offset', offset:{value, window}, dependency:{ref} }.
  const kind = d?.kind ?? d?.type;
  if (kind === 'fixed') return 'on a fixed date';
  if (kind === 'recurring') return 'recurring';

  const off = d?.offset ?? d?.rule ?? d?.compute ?? {};
  const days = off.value ?? off.days ?? off.offsetDays ?? d?.days;
  if (days === undefined || days === null) return '';

  const unit = Math.abs(days) === 1 ? 'day' : 'days';
  // Counting rules are what make a court deadline differ from a calendar one,
  // so say which is being counted rather than leaving it to be assumed.
  const counting = d?.counting;
  const courtDays = counting && counting.CountWeekends === false;
  const dayWord = courtDays ? `working ${unit}` : unit;

  // Where it is measured from: another step, or the matter's trigger date.
  const ref = d?.dependency?.ref ?? off.offsetId ?? off.from;
  let rel = 'from the trigger date';
  if (ref && ref !== '_date_') {
    const parent = all.find((x) => x.id === ref);
    rel = parent ? `after ${parent.label || parent.name}` : 'after the previous step';
  }

  return `${Math.abs(days)} ${dayWord} ${days < 0 ? 'before ' : ''}${rel}`.replace(/\s+/g, ' ').trim();
}

</script>

<template>
  <!-- Shared body for the manage Popover (desktop) and Drawer (mobile). -->
  <DefineManageList v-slot="{ template: t }">
    <div class="flex flex-col">
      <button
        v-for="a in actionsFor(t)" :key="a.key"
        type="button"
        class="flex items-start gap-2.5 rounded-md p-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
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
        <SheetTitle class="flex items-center gap-2">
          <Scale class="size-4" /> Procedures
        </SheetTitle>
        <SheetDescription>
          The court procedures your matters run on. Each one computes its own deadlines from the rules.
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        <Button variant="outline" class="gap-1.5 w-full" @click="openStudio()">
          <Wand2 class="size-4" /> Author a procedure in Matter Studio
        </Button>

        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input v-model="query" placeholder="Search procedures…" class="pl-9" />
        </div>

        <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 class="size-4 animate-spin" /> Loading…
        </div>
        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

        <template v-else>
          <section v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ g.label }}</h3>
              <p class="text-[11px] text-muted-foreground/80">{{ g.hint }}</p>
            </div>
            <p v-if="!g.items.length" class="text-sm text-muted-foreground">{{ g.empty }}</p>

            <div v-for="t in g.items" :key="t.id" :id="`procedure-${t.id}`" class="rounded-lg border bg-muted/40">
              <div class="flex items-start gap-2 p-3 cursor-pointer" @click="toggle(t.id)">
                <component :is="expandedId === t.id ? ChevronDown : ChevronRight" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ t.name }}</span>
                    <Badge variant="outline" class="gap-1 text-[10px]">
                      <component :is="g.key === 'firm' ? Building2 : ShieldCheck" class="size-2.5" />
                      {{ g.key === 'firm' ? 'Firm' : 'PractoCore' }}
                    </Badge>
                    <Badge v-if="t.status && t.status !== 'active'" variant="outline" class="text-[10px] capitalize">
                      {{ t.status }}
                    </Badge>
                  </div>

                  <p v-if="t.description" class="text-xs text-muted-foreground line-clamp-2 mt-0.5">{{ t.description }}</p>

                  <p v-if="g.key === 'firm' && baseNameOf(t)" class="text-[11px] text-muted-foreground mt-0.5">
                    Extends <span class="font-medium">{{ baseNameOf(t) }}</span>
                  </p>

                  <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span class="flex items-center gap-1">
                      <CalendarClock class="size-3" />
                      {{ deadlinesOf(t).length }} deadline{{ deadlinesOf(t).length === 1 ? '' : 's' }}
                    </span>
                    <span v-if="t.fieldCount" class="flex items-center gap-1">
                      <ListChecks class="size-3" /> {{ t.fieldCount }} field{{ t.fieldCount === 1 ? '' : 's' }}
                    </span>
                    <span v-if="t.conditionalCount" class="flex items-center gap-1">
                      <Layers class="size-3" /> {{ t.conditionalCount }} conditional{{ t.conditionalCount === 1 ? '' : 's' }}
                    </span>
                    <span v-if="t.courtLevel" class="capitalize">{{ String(t.courtLevel).replace(/_/g, ' ') }}</span>
                    <span v-if="t.version">v{{ t.version }}</span>
                  </div>
                </div>

                <!-- Row actions. Stops propagation so reaching for an action
                     doesn't also expand/collapse the row underneath. -->
                <div class="flex items-center gap-1 shrink-0" @click.stop>
                  <Popover
                    v-if="$viewport.isGreaterOrEquals('customxs')"
                    :open="manageFor?.id === t.id"
                    @update:open="(v) => { manageFor = v ? t : null; }"
                  >
                    <PopoverTrigger as-child>
                      <Button size="icon-sm" variant="ghost" title="Manage procedure">
                        <Settings2 class="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" class="w-64 p-1">
                      <ReuseManageList :template="t" />
                    </PopoverContent>
                  </Popover>
                  <Button
                    v-else
                    size="icon-sm" variant="ghost" title="Manage procedure"
                    @click="manageFor = t"
                  >
                    <Settings2 class="size-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    class="shrink-0 gap-1 text-xs h-7"
                    title="Start a matter from this procedure"
                    @click="useProcedure(t)"
                  >
                    Use
                    <ArrowRight class="size-3" />
                  </Button>
                </div>
              </div>

              <!-- Expanded: what this procedure will actually put on a timeline. -->
              <div v-if="expandedId === t.id" class="border-t px-3 py-2.5 flex flex-col gap-2">
                <p v-if="triggerLabelOf(t)" class="text-xs">
                  <span class="text-muted-foreground mr-1">Starts from:</span>
                  <span class="font-medium">{{ triggerLabelOf(t) }}</span>
                </p>

                <ul v-if="deadlinesOf(t).length" class="flex flex-col gap-1.5">
                  <li v-for="(d, i) in deadlinesOf(t)" :key="d.id ?? i" class="flex items-baseline gap-2 text-xs">
                    <span class="text-muted-foreground tabular-nums shrink-0">{{ i + 1 }}.</span>
                    <span class="min-w-0 flex-1">
                      <span class="font-medium">{{ d.label || d.name || 'Untitled step' }}</span>
                      <span v-if="describeDeadline(d, deadlinesOf(t))" class="text-muted-foreground"> — {{ describeDeadline(d, deadlinesOf(t)) }}</span>
                    </span>
                  </li>
                </ul>
                <p v-else class="text-xs text-muted-foreground">This procedure has no deadlines recorded.</p>
              </div>
            </div>
          </section>

          <p v-if="!filtered.length && query" class="text-sm text-muted-foreground">
            No procedure matches “{{ query }}”.
          </p>
        </template>
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
        <DrawerTitle class="text-base">Manage procedure</DrawerTitle>
        <DrawerDescription class="truncate">{{ manageFor?.name }}</DrawerDescription>
      </DrawerHeader>
      <div class="px-3 pb-6">
        <ReuseManageList v-if="manageFor" :template="manageFor" />
      </div>
    </DrawerContent>
  </Drawer>

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
              <Badge v-if="v.version" variant="outline" class="text-[10px]">v{{ v.version }}</Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ v.name }}</p>
            <p class="text-[11px] text-muted-foreground mt-1">
              {{ fmtWhen(v.created) }}<span v-if="v.authorName"> · {{ v.authorName }}</span>
            </p>
            <p v-if="v.note" class="text-[11px] text-muted-foreground italic mt-0.5">{{ v.note }}</p>
          </div>
          <Button
            v-if="i > 0 && historyRestorable"
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

        <p v-if="versions.length && historyRestorable" class="text-[11px] text-muted-foreground mt-2 border-t pt-3">
          Restoring keeps the current version in this list, so it can be undone.
          Matters already built on this procedure keep the timelines they were given —
          a restore changes what the NEXT matter computes, never a running one.
        </p>
        <p v-else-if="versions.length" class="text-[11px] text-muted-foreground mt-2 border-t pt-3">
          PractoCore maintains this procedure, so its revisions are ours to make — they
          are shown here so you can see what changed and when. Matters already built on
          it keep the timelines they were given; a revision changes what the NEXT matter
          computes, never a running one.
        </p>
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog :open="!!deleteTarget" @update:open="(v) => { if (!v) deleteTarget = null; }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{{ deleteTarget?.name }}"?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the procedure and its version history. Matters already built on it
          keep their timelines — deadlines are computed and stored when a matter is created,
          not read back from here. This can't be undone.
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

  <!-- Dialog on desktop, drawer on mobile — the component decides. -->
  <CreateMatterDialog v-model:open="createOpen" :template="chosen" @created="createOpen = false" />
</template>
