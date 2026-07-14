<script lang="ts" setup>
import { Briefcase, Plus, Loader2, Wand2, Trash2, Check, X, ListChecks, Layers, Search } from 'lucide-vue-next';
import { vOnLongPress } from '@vueuse/components';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import {
  listEngagements, deleteEngagement,
  type Engagement,
} from '~/services/engagements';

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
function openCreate() { createOpen.value = true; }

// ── Multi-select + delete ──────────────────────────────────────────────────
// Mirrors the Matters grid: long-press (or the "Select" toggle) enters a
// selection mode, taps toggle membership, and a floating bar bulk-deletes.
const selectionActive = ref(false);
const selected = ref<Engagement[]>([]);
const selectedIds = computed(() => new Set(selected.value.map((e: Engagement) => e.id)));
const deleteOpen = ref(false);
const deleting = ref(false);

// Guards against the tap handler firing immediately after a long-press activates
// selection (the pointerup that ends the hold also fires a click).
let selectionJustActivated = false;

async function triggerSelectionHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try { await Haptics.selectionChanged(); } catch (e) { console.warn('Haptics failed:', e); }
}

function activateSelectionWith(_e: PointerEvent, engagement: Engagement) {
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

async function deleteSelected() {
  if (selected.value.length === 0) return;
  deleting.value = true;
  const ids = selected.value.map((e: Engagement) => e.id);
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

      <div
        v-else
        role="list"
        aria-label="Engagements"
        class="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-3 p-3 content-start"
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
    </template>

    <SharedEngagementsCreateEngagement v-model:open="createOpen" />

    <SharedEngagementsPlaybookLibrary v-model:open="libraryOpen" @changed="onLibraryChanged" />

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

          <AlertDialog v-model:open="deleteOpen">
            <AlertDialogTrigger as-child>
              <Button size="icon" variant="destructive" :disabled="selected.length === 0" aria-label="Delete selected engagements">
                <Trash2 class="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {{ selected.length }} engagement{{ selected.length === 1 ? '' : 's' }}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the selected engagement{{ selected.length === 1 ? '' : 's' }} and all of their
                  milestones. This can't be undone.
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

          <Button size="icon" variant="secondary" aria-label="Cancel selection" @click="resetSelection">
            <X class="size-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
