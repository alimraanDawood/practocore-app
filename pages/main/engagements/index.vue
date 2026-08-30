<script lang="ts" setup>
import {
  Briefcase, Plus, Loader2, Wand2, Trash2, Check, X, ListChecks, Layers, Search,
  FolderOpen, Pencil, PlayCircle, CheckCircle2, FileEdit, Archive, RefreshCw, CheckSquare,
} from 'lucide-vue-next';
import { vOnLongPress } from '@vueuse/components';
import { useMediaQuery } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import {
  listEngagements, deleteEngagement, updateEngagement,
  type Engagement,
} from '~/services/engagements';
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue';

definePageMeta({ layout: 'default' });

const router = useRouter();
const route = useRoute();

const engagements = ref<Engagement[]>([]);
const loading = ref(true);
const loadError = ref('');

// ── Search + status filter (client-side over the loaded page) ────────────────
const query = ref('');
type StatusFilter = 'all' | 'draft' | 'active' | 'completed' | 'archived';
const statusFilter = ref<StatusFilter>('all');
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const filteredEngagements = computed(() => {
  const q = query.value.trim().toLowerCase();
  return engagements.value.filter((e) => {
    if (statusFilter.value !== 'all' && e.status !== statusFilter.value) return false;
    if (!q) return true;
    const hay = `${e.name} ${e.expand?.template?.name ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
});

// Per-status counts for the filter chips (from the full loaded set).
const statusCounts = computed(() => {
  const counts: Record<string, number> = { all: engagements.value.length };
  for (const e of engagements.value) counts[e.status] = (counts[e.status] ?? 0) + 1;
  return counts;
});

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await listEngagements(1, 50);
    engagements.value = res.items;
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load engagements.';
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  refresh();
  // Deep-linked from the unified "New work" picker — open the create dialog and
  // strip the flag so a refresh doesn't reopen it.
  if (route.query.new === '1') {
    openCreate();
    router.replace({ query: { ...route.query, new: undefined } });
  }
});

// ── Playbook library ───────────────────────────────────────────────────────
const libraryOpen = ref(false);
// CreateEngagement reloads its own template list each time it opens, so a
// duplicated/deleted playbook is always reflected — nothing to invalidate here.
function onLibraryChanged() { /* no-op: create flow reloads templates on open */ }

// ── Create flow (multi-step Drawer on mobile, Dialog on desktop) ─────────────
const createOpen = ref(false);
// Set only by the library's "Use →" button; cleared for a plain "New engagement"
// so the flow opens on the picker rather than the last-used playbook.
const createTemplateId = ref('');
function openCreate() { createTemplateId.value = ''; createOpen.value = true; }

// The library closes itself before emitting, so the create Dialog/Drawer doesn't
// stack on the Sheet.
function onUsePlaybook(templateId: string) {
  createTemplateId.value = templateId;
  // Let the Sheet finish its exit animation first: opening a second overlay while
  // the first is still unmounting fights over the body scroll lock.
  setTimeout(() => { createOpen.value = true; }, 200);
}

// ── Multi-select + delete ──────────────────────────────────────────────────
// Mirrors the Matters grid: long-press (or the "Select" toggle) enters a
// selection mode, taps toggle membership, and a floating bar bulk-deletes.
const selectionActive = ref(false);
const selected = ref<Engagement[]>([]);
const selectedIds = computed(() => new Set(selected.value.map((e: Engagement) => e.id)));
const deleteOpen = ref(false);
const deleting = ref(false);
// What the open confirmation is about. The selection bar fills this with the
// whole selection; a right-click menu fills it with whatever it was aimed at, so
// deleting one card no longer requires selecting it first.
const deleteTargets = ref<Engagement[]>([]);

// Guards against the tap handler firing immediately after a long-press activates
// selection (the pointerup that ends the hold also fires a click).
let selectionJustActivated = false;

async function triggerSelectionHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try { await Haptics.selectionChanged(); } catch (e) { console.warn('Haptics failed:', e); }
}

function activateSelectionWith(e: PointerEvent, engagement: Engagement) {
  // A right-press is the context menu's business. vueuse's long-press timer does
  // not filter by button, so without this a held right-click would open the menu
  // AND drop the page into selection mode behind it.
  if (e.button === 2 || e.buttons === 2) return;
  selectionJustActivated = true;
  selectionActive.value = true;
  if (!selectedIds.value.has(engagement.id)) selected.value.push(engagement);
  triggerSelectionHaptic();
  setTimeout(() => { selectionJustActivated = false; }, 50);
}

function toggleSelectionMode() {
  if (selectionActive.value) resetSelection();
  else selectionActive.value = true;
}

function resetSelection() {
  selectionActive.value = false;
  selected.value = [];
}

function onCardTap(engagement: Engagement) {
  if (selectionJustActivated) return;
  if (selectionActive.value) {
    if (selectedIds.value.has(engagement.id)) {
      selected.value = selected.value.filter((e: Engagement) => e.id !== engagement.id);
      if (selected.value.length === 0) selectionActive.value = false;
    } else {
      selected.value.push(engagement);
    }
    triggerSelectionHaptic();
    return;
  }
  router.push(`/main/engagements/${engagement.id}`);
}

// ── Right-click menus ───────────────────────────────────────────────────────
// The vault's model, brought to this grid: everything you can do to an
// engagement is described once as an action list (`MenuAction`) and rendered
// into whichever menu is asking, so a card's menu and the empty-space menu can
// never drift apart from each other or from the buttons in the header.
//
// A menu opened on a card that is part of a live selection acts on the whole
// selection; opened on any other card it acts on that card alone and leaves the
// selection untouched — right-clicking to rename one thing should not silently
// redefine what is selected.
//
// Touch has no context menu at all. reka's trigger arms a long-press of its own,
// which would land on top of the long-press that starts a selection here (and
// can leave the body pointer-events lock behind when dismissed — see CLAUDE.md).
// A finger selects first and uses the action bar, exactly as it does in the vault.
const coarsePointer = useMediaQuery('(pointer: coarse)');

// What the open menu is aimed at: a card, or null for the page itself. There is
// ONE menu for the whole grid rather than one per card — a menu per card meant
// each was its own dismissable layer, so right-clicking a second card opened a
// second menu with the first still standing. Reka re-anchors the single menu at
// each new right-click, so the same gesture now moves it and swaps its contents.
//
// Set in the target phase by the card; cleared first by the grid's own CAPTURE
// handler, which runs top-down before it — so a right-click that lands on empty
// space leaves it null and gets the page's menu.
const ctxTarget = ref<Engagement | null>(null);

// Menus and dialogs are separate overlay layers: opening the second while the
// first is still closing makes them race for the body scroll lock.
const defer = (fn: () => void) => setTimeout(fn, 0);

const STATUS_ACTIONS: { status: Engagement['status']; label: string; icon: any }[] = [
  { status: 'draft', label: 'Move back to draft', icon: FileEdit },
  { status: 'active', label: 'Mark as active', icon: PlayCircle },
  { status: 'completed', label: 'Mark as completed', icon: CheckCircle2 },
  { status: 'archived', label: 'Archive', icon: Archive },
];

const savingStatus = ref(false);

/** Set a status on every target, then re-sync so the filter counts stay honest. */
async function setStatusFor(list: Engagement[], status: Engagement['status']) {
  if (list.length === 0 || savingStatus.value) return;
  savingStatus.value = true;
  let failed = 0;
  for (const e of list) {
    try {
      const updated = await updateEngagement(e.id, { status });
      // Patch in place so the card re-renders before the refresh lands.
      const i = engagements.value.findIndex((x) => x.id === e.id);
      if (i !== -1) engagements.value[i] = { ...engagements.value[i], ...updated };
    } catch (err) {
      failed++;
      console.error(err);
    }
  }
  savingStatus.value = false;
  resetSelection();
  if (failed > 0) toast.error(`${failed} engagement${failed === 1 ? '' : 's'} could not be updated.`);
  else toast.success(list.length === 1 ? `Moved to ${status}.` : `${list.length} engagements moved to ${status}.`);
}

// ── Rename ─────────────────────────────────────────────────────────────────
const renameTarget = ref<Engagement | null>(null);
const renameValue = ref('');
const renaming = ref(false);

function askRename(e: Engagement) {
  defer(() => { renameTarget.value = e; renameValue.value = e.name; });
}

async function submitRename() {
  const name = renameValue.value.trim();
  if (!name || !renameTarget.value || renaming.value) return;
  renaming.value = true;
  try {
    const updated = await updateEngagement(renameTarget.value.id, { name });
    const i = engagements.value.findIndex((x) => x.id === updated.id);
    if (i !== -1) engagements.value[i] = { ...engagements.value[i], ...updated };
    renameTarget.value = null;
  } catch (err: any) {
    toast.error(err?.message || 'Could not rename the engagement.');
  } finally {
    renaming.value = false;
  }
}

function toggleMembership(e: Engagement) {
  selectionActive.value = true;
  if (selectedIds.value.has(e.id)) {
    selected.value = selected.value.filter((x: Engagement) => x.id !== e.id);
    if (selected.value.length === 0) selectionActive.value = false;
  } else {
    selected.value.push(e);
  }
}

/** What this card's right-click menu offers. */
function actionsFor(e: Engagement): MenuAction[] {
  const many = selectedIds.value.has(e.id) && selected.value.length > 1;
  const targets = many ? [...selected.value] : [e];
  const suffix = many ? ` (${targets.length})` : '';
  const out: MenuAction[] = [];

  if (!many) {
    const alone = selectedIds.value.has(e.id) && selected.value.length === 1;
    out.push({
      id: 'open', label: 'Open', icon: FolderOpen,
      run: () => router.push(`/main/engagements/${e.id}`),
    });
    out.push({
      id: 'rename', label: 'Rename', icon: Pencil, shortcut: alone ? 'F2' : undefined,
      run: () => askRename(e),
    });
  }

  // Only the statuses it isn't already in — an action that would do nothing is
  // noise. On a multi-selection all four are offered, since the targets differ.
  let first = true;
  for (const s of STATUS_ACTIONS) {
    if (!many && e.status === s.status) continue;
    out.push({
      id: `status-${s.status}`, label: `${s.label}${suffix}`, icon: s.icon,
      divider: first && out.length > 0, run: () => setStatusFor(targets, s.status),
    });
    first = false;
  }

  out.push({
    id: 'select',
    label: selectedIds.value.has(e.id) ? 'Deselect' : 'Select',
    icon: CheckSquare, divider: true,
    run: () => toggleMembership(e),
  });

  out.push({
    id: 'delete', label: `Delete${suffix}`, icon: Trash2, danger: true, divider: true,
    shortcut: selectedIds.value.has(e.id) ? 'Del' : undefined,
    run: () => askDelete(targets),
  });
  return out;
}

/**
 * What can be done to the page rather than to any one card — the menu on empty
 * space, which is where creating belongs: a new engagement is aimed at *here*,
 * and every other menu on this screen is aimed at a card.
 */
const surfaceActions = computed<MenuAction[]>(() => {
  const out: MenuAction[] = [
    { id: 'new', label: 'New engagement', icon: Plus, run: () => defer(openCreate) },
    { id: 'playbooks', label: 'Playbooks', icon: Layers, run: () => defer(() => { libraryOpen.value = true; }) },
  ];
  if (filteredEngagements.value.length > 0) {
    out.push({
      id: 'select-all', label: 'Select all', icon: CheckSquare, divider: true,
      run: () => { selectionActive.value = true; selected.value = [...filteredEngagements.value]; },
    });
    if (selectionActive.value) {
      out.push({ id: 'clear', label: 'Clear selection', icon: X, run: resetSelection });
    }
  }
  out.push({ id: 'refresh', label: 'Refresh', icon: RefreshCw, divider: true, run: refresh });
  return out;
});

// ── Keyboard ────────────────────────────────────────────────────────────────
// The keys the menus advertise, and only those. Bound to the window because
// nothing on this page holds focus, and they all act on the SELECTION — which is
// what the hints say, since a shortcut has no card under the pointer to aim at.
function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function onKeydown(e: KeyboardEvent) {
  // A dialog is its own world; Escape there closes the dialog, not the selection.
  if (isTyping(e.target) || deleteOpen.value || renameTarget.value || createOpen.value || libraryOpen.value) return;
  if (e.key === 'Escape' && selectionActive.value) { resetSelection(); return; }
  if (!selected.value.length) return;
  if (e.key === 'Delete') { e.preventDefault(); askDelete(selected.value); return; }
  const only = selected.value.length === 1 ? selected.value[0] : null;
  if (e.key === 'F2' && only) { e.preventDefault(); askRename(only); }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function askDelete(list: Engagement[]) {
  if (list.length === 0) return;
  // Let the menu finish closing before the dialog mounts: two overlays whose
  // open/close overlap fight over the body scroll lock (see CLAUDE.md).
  deleteTargets.value = [...list];
  defer(() => { deleteOpen.value = true; });
}

async function deleteSelected() {
  if (deleteTargets.value.length === 0) return;
  deleting.value = true;
  const ids = deleteTargets.value.map((e: Engagement) => e.id);
  let failed = 0;
  for (const id of ids) {
    try {
      await deleteEngagement(id);
    } catch (e) {
      failed++;
      console.error(e);
    }
  }
  deleteOpen.value = false;
  deleting.value = false;
  deleteTargets.value = [];
  resetSelection();
  // Re-sync from the server so a partial failure leaves an accurate list.
  await refresh();
  if (failed > 0) loadError.value = `${failed} engagement(s) could not be deleted.`;
}
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b p-3">
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-semibold flex items-center gap-2 ibm-plex-serif">
          <SidebarTrigger class="lg:hidden" />
          Engagements
        </h1>
        <p class="text-sm text-muted-foreground">
          Advisory, transactional, and regulatory work — anything that isn't a court case.
        </p>
      </div>
      <div class="flex flex-row lg:items-center gap-2 w-full lg:w-fit">
        <Button
          v-if="engagements.length > 0"
          :variant="selectionActive ? 'secondary' : 'outline'"
          @click="toggleSelectionMode"
          class="hidden lg:flex"
        >
          <ListChecks class="size-4 mr-1.5" />
          {{ selectionActive ? 'Cancel' : 'Select' }}
        </Button>
        <Button variant="outline" class="flex-1" @click="libraryOpen = true">
          <Layers class="size-4 mr-1.5" />
          Playbooks
        </Button>
<!--        <Button variant="outline" class="flex-1" @click="router.push('/main/engagements/studio')">-->
<!--          <Wand2 class="size-4 mr-1.5" />-->
<!--          Build a playbook-->
<!--        </Button>-->
        <Button @click="openCreate" class="flex-1">
          <Plus class="size-4 mr-1.5" />
          New engagement
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center p-5 text-muted-foreground">
      <Loader2 class="size-5 animate-spin mr-2" /> Loading…
    </div>

    <div v-else-if="loadError" class="text-sm text-destructive p-5">{{ loadError }}</div>

    <div v-else-if="engagements.length === 0" class="flex flex-col items-center justify-center py-5 text-center gap-2 text-muted-foreground">
      <Briefcase class="size-8" />
      <p>No engagements yet.</p>
      <Button variant="outline" size="sm" @click="openCreate">Create your first engagement</Button>
    </div>

    <template v-else>
      <!-- Search + status filter -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b">
        <div class="relative w-full sm:max-w-xs">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input v-model="query" placeholder="Search engagements…" class="pl-9" />
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <Button
            v-for="f in statusFilters"
            :key="f.value"
            size="sm"
            :variant="statusFilter === f.value ? 'secondary' : 'ghost'"
            class="gap-1.5"
            @click="statusFilter = f.value"
          >
            {{ f.label }}
            <Badge v-if="statusCounts[f.value]" variant="outline" class="text-[10px] px-1">{{ statusCounts[f.value] }}</Badge>
          </Button>
        </div>
      </div>

      <div
        v-if="filteredEngagements.length === 0"
        class="flex flex-col items-center justify-center py-10 text-center gap-2 text-muted-foreground"
      >
        <Search class="size-7 opacity-40" />
        <p class="text-sm">No engagements match your search.</p>
        <Button variant="ghost" size="sm" @click="query = ''; statusFilter = 'all'">Clear filters</Button>
      </div>

      <!-- The grid is a right-click target in its own right: the empty space
           between cards carries the page's own menu (new engagement, playbooks,
           select all), while each card carries its own. A card stops the event
           so the two never both open. -->
      <ContextMenu v-else>
        <ContextMenuTrigger as-child :disabled="coarsePointer">
          <div
            role="list"
            aria-label="Engagements"
            class="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-3 p-3 content-start"
            @contextmenu.capture="ctxTarget = null"
          >
            <div
              v-for="e in filteredEngagements"
              :key="e.id"
              role="listitem"
              :aria-selected="selectionActive ? selectedIds.has(e.id) : undefined"
              :class="{ 'ring-2 ring-tertiary': selectedIds.has(e.id) }"
              class="relative h-full ring-1 ring-border rounded-lg cursor-pointer select-none"
              v-on-long-press="[(evt) => activateSelectionWith(evt, e), { delay: 300, modifiers: { stop: true } }]"
              @click="onCardTap(e)"
              @contextmenu="ctxTarget = e"
            >
              <SharedEngagementsEngagementCard :engagement="e" />

              <div
                v-if="selectedIds.has(e.id)"
                aria-hidden="true"
                class="size-5 bg-tertiary grid place-items-center text-primary-foreground absolute top-0 -translate-y-1/2 right-0 translate-x-1/2 rounded-full">
                <Check class="size-3 stroke-3" />
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-60">
          <SharedActionMenuItems
            :actions="ctxTarget ? actionsFor(ctxTarget) : surfaceActions"
            variant="context" />
        </ContextMenuContent>
      </ContextMenu>
    </template>

    <SharedEngagementsCreateEngagement v-model:open="createOpen" :template-id="createTemplateId" />

    <SharedEngagementsPlaybookLibrary
      v-model:open="libraryOpen"
      @changed="onLibraryChanged"
      @use="onUsePlaybook"
    />

    <!-- Floating selection bar (mirrors the Matters grid): count + Select All +
         bulk delete + cancel. -->
    <div
      v-if="selectionActive"
      class="fixed inset-x-0 bottom-0 z-30 flex justify-center p-3"
    >
      <div class="flex w-full flex-row items-center justify-between gap-2 rounded border bg-background p-3 shadow-sm lg:max-w-md">
        <div class="flex items-center gap-2 text-xs">
          <div class="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
            {{ selected.length }}
          </div>
          of {{ filteredEngagements.length }} selected
        </div>

        <div class="flex flex-row items-center gap-2">
          <Button size="sm" variant="secondary" @click="selected = [...filteredEngagements]">Select All</Button>

          <Button
            size="icon" variant="destructive" :disabled="selected.length === 0"
            aria-label="Delete selected engagements" @click="askDelete(selected)">
            <Trash2 class="size-4" />
          </Button>

          <Button size="icon" variant="secondary" aria-label="Cancel selection" @click="resetSelection">
            <X class="size-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation. Controlled rather than trigger-wrapped, because it
         is now opened from two places: the selection bar and a card's menu. -->
    <AlertDialog v-model:open="deleteOpen" @update:open="(v: boolean) => { if (!v) deleteTargets = []; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ deleteTargets.length }} engagement{{ deleteTargets.length === 1 ? '' : 's' }}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes
            <template v-if="deleteTargets.length === 1">“{{ deleteTargets[0]?.name }}”</template>
            <template v-else>the selected engagements</template>
            and all of their milestones. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleting" @click="deleteSelected">
            <Loader2 v-if="deleting" class="size-4 animate-spin mr-1.5" />
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Rename -->
    <Dialog :open="!!renameTarget" @update:open="(v: boolean) => { if (!v) renameTarget = null; }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename engagement</DialogTitle>
          <DialogDescription class="break-words">{{ renameTarget?.name }}</DialogDescription>
        </DialogHeader>
        <Input v-model="renameValue" autofocus @keydown.enter="submitRename" />
        <DialogFooter>
          <Button variant="outline" @click="renameTarget = null">Cancel</Button>
          <Button :disabled="renaming || !renameValue.trim()" class="gap-1.5" @click="submitRename">
            <Loader2 v-if="renaming" class="size-4 animate-spin" />
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
