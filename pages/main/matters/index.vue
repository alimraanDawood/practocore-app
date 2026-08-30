<template>
    <div class="flex flex-col w-full h-full overflow-y-auto lg:overflow-y-hidden border-x">
        <div class="flex flex-col h-full w-full">
            <DefinePaginationTemplate>
                <div v-if="(mattersStore?.totalItems / mattersStore?.perPage) > 1"
                    class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t">
                    <div class="text-sm text-muted-foreground">
                        Showing {{ ((mattersStore.page - 1) * mattersStore.perPage) + 1 }} to {{ Math.min(mattersStore.page * mattersStore.perPage, matters.totalItems) }} of {{ matters.totalItems }} matters
                    </div>
                    <nav aria-label="Matters pagination" class="flex flex-row items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            @click="mattersStore.previousPage()"
                            :disabled="mattersStore.page <= 1"
                        >
                            <ChevronLeft class="size-4" />
                            Previous
                        </Button>
                        <div class="flex flex-row items-center gap-1">
                            <template v-for="(pageNum, idx) in visiblePages" :key="idx">
                                <span v-if="pageNum === -1" class="px-2 text-muted-foreground" aria-hidden="true">...</span>
                                <Button
                                    v-else
                                    size="sm"
                                    :variant="pageNum === mattersStore.page ? 'default' : 'ghost'"
                                    @click="mattersStore.goToPage(pageNum)"
                                    class="min-w-[2.75rem]"
                                    :aria-label="`Page ${pageNum}`"
                                    :aria-current="pageNum === mattersStore.page ? 'page' : undefined"
                                >
                                    {{ pageNum }}
                                </Button>
                            </template>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            @click="mattersStore.nextPage()"
                            :disabled="mattersStore.page >= matters.totalPages"
                        >
                            Next
                            <ChevronRight class="size-4" />
                        </Button>
                    </nav>
                </div>
            </DefinePaginationTemplate>

            <div class="flex flex-col w-full h-full">
                <!-- Header -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b p-3">
                    <div class="flex flex-col gap-1">
                        <h1 class="text-xl font-semibold flex items-center gap-2 ibm-plex-serif">
                            <SidebarTrigger class="lg:hidden" />
                            Your Matters
                            <span
                                v-if="_offlineFallback"
                                class="flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-400"
                            >
                                <WifiOff class="size-3" /> Cached
                            </span>
                        </h1>
                        <p class="text-sm text-muted-foreground">
                            Court cases, and the deadlines the rules compute for them.
                        </p>
                    </div>

                    <div class="flex flex-row lg:items-center gap-2 w-full lg:w-fit">
                        <!-- Hidden on mobile, where a long press enters selection. -->
                        <Button
                            v-if="matters?.items?.length > 0"
                            :variant="selection.active ? 'secondary' : 'outline'"
                            class="hidden lg:flex"
                            @click="toggleSelectionMode"
                        >
                            <ListChecks class="size-4 mr-1.5" />
                            {{ selection.active ? 'Cancel' : 'Select' }}
                        </Button>

                        <Button variant="outline" class="flex-1 lg:flex-none" @click="procedureLibraryOpen = true">
                            <Scale class="size-4 mr-1.5" />
                            Procedures
                        </Button>

                        <Button
                            v-if="hasPermission('canCreateMatters')"
                            class="flex-1 lg:flex-none"
                            :disabled="!!createDisabledReason"
                            :title="createDisabledReason"
                            @click="createOpen = true"
                        >
                            <Plus class="size-4 mr-1.5" />
                            Add Matter
                        </Button>
                    </div>
                </div>

                <!-- Search, status, sort -->
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b">
                    <div class="relative w-full sm:max-w-xs">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                        <Input v-model="query" placeholder="Search matters…" class="pl-9" />
                        <span
                            v-if="query.length > 0"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                        >
                            {{ matters?.totalItems }} results
                        </span>
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap">
                        <Button
                            v-for="f in statusFilters"
                            :key="f.value"
                            size="sm"
                            :variant="statusFilter === f.value ? 'secondary' : 'ghost'"
                            @click="statusFilter = f.value"
                        >
                            {{ f.label }}
                        </Button>
                    </div>

                    <Dialog v-if="false">
                        <DialogTrigger as-child>
                            <Button variant="ghost" size="sm" class="gap-1.5 sm:ml-auto" aria-label="Sort matters">
                                <SortAsc v-if="sortLabel?.asc" class="size-4" />
                                <SortDesc v-else class="size-4" />
                                <span class="hidden md:inline">{{ sortLabel?.label }}</span>
                                <span class="md:hidden">Sort</span>
                            </Button>
                        </DialogTrigger>

                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Sort matters</DialogTitle>
                            </DialogHeader>

                            <RadioGroup :model-value="sort" class="flex flex-col gap-3 p-1" @update:model-value="v => sort = v">
                                <div v-for="o in sortOptions" :key="o.value" class="flex items-center gap-2">
                                    <RadioGroupItem :id="o.value" :value="o.value" />
                                    <SortAsc v-if="o.asc" class="size-4 text-muted-foreground" />
                                    <SortDesc v-else class="size-4 text-muted-foreground" />
                                    <Label :for="o.value" class="font-normal cursor-pointer">{{ o.label }}</Label>
                                </div>
                            </RadioGroup>
                        </DialogContent>
                    </Dialog>
                </div>

                <XyzTransition mode="out-in" xyz="fade">
                    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-3 p-3">
                        <div v-for="i in 12" :key="i" class="rounded w-full aspect-[4/3] bg-muted-foreground/20 animate-pulse" />
                    </div>

                    <template v-else-if="matters !== null && matters?.items?.length > 0">
                        <div class="flex flex-col w-full h-full overflow-y-hidden">
                            <!-- The grid is a right-click target in its own right: the
                                 empty space between cards carries the page's own menu
                                 (add matter, procedures, select all), while each card
                                 carries its own. A card stops the event so the two
                                 never both open. -->
                            <ContextMenu>
                            <ContextMenuTrigger as-child :disabled="coarsePointer">
                            <div
                                role="list"
                                aria-label="Matters"
                                class="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 h-full gap-3 p-3 content-start overflow-y-scroll"
                                @contextmenu.capture="ctxTarget = null">

                                <div
                                    v-for="(matter, index) in matters?.items"
                                    :key="matter.id"
                                    role="listitem"
                                    :aria-selected="selection.active ? selectedIds.has(matter.id) : undefined"
                                    :class="{
                                        'ring-2 ring-tertiary': selectedIds.has(matter.id),
                                        'ring-destructive/50': !selectedIds.has(matter.id) && matterUrgencies.get(matter.id) === 'overdue',
                                    }"
                                    class="relative h-full ring-1 ring-border rounded-lg cursor-pointer select-none"
                                    v-on-long-press="[(e) => activateSelectionWith(e, matter), { delay: 300, modifiers: { stop: true } }]"
                                    @click="onMatterTap(matter)"
                                    @contextmenu="ctxTarget = matter"
                                >
                                    <PageComponentsHomeMatter
                                        :matter="matter"
                                        :accent-index="index"
                                        :urgency="matterUrgencies.get(matter.id)"
                                    />

                                    <div
                                        v-if="selectedIds.has(matter.id)"
                                        aria-hidden="true"
                                        class="size-5 bg-tertiary grid place-items-center text-primary-foreground absolute top-0 translate-y-[-50%] right-0 translate-x-[50%] rounded-full">
                                        <Check class="size-3 stroke-3" />
                                    </div>
                                </div>

                                <div class="col-span-full sm:hidden">
                                    <ReusePaginationTemplate />
                                </div>
                            </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent class="w-60">
                                <SharedActionMenuItems
                                    :actions="ctxTarget ? actionsFor(ctxTarget) : surfaceActions"
                                    variant="context" />
                            </ContextMenuContent>
                            </ContextMenu>

                            <div class="hidden sm:block">
                                <ReusePaginationTemplate />
                            </div>
                        </div>
                    </template>

                    <!-- An empty grid means two different things, and saying "no
                         matters yet" for both told a firm whose files are all closed
                         that it had none at all — the list opens on the Active
                         filter. Named separately, as on the engagements page. -->
                    <div v-else-if="matters?.items?.length === 0 && hasActiveFilters"
                        class="flex flex-col h-full w-full items-center justify-center">
                        <div class="flex flex-col items-center gap-3 max-w-xs text-center text-muted-foreground">
                            <Search class="size-10 opacity-40" />
                            <p class="text-sm">No matters match your search.</p>
                            <Button variant="ghost" size="sm" @click="clearFilters">Clear filters</Button>
                        </div>
                    </div>

                    <div v-else-if="matters?.items?.length === 0"
                        class="flex flex-col h-full w-full items-center justify-center">
                        <div class="flex flex-col items-center gap-4 max-w-xs text-center">
                            <Scale class="size-16 text-muted-foreground opacity-40" />
                            <div class="flex flex-col gap-1">
                                <span class="font-semibold text-foreground">No matters yet</span>
                                <span class="text-sm text-muted-foreground">Add your first matter to start tracking litigation deadlines.</span>
                            </div>
                            <Button v-if="hasPermission('canCreateMatters')" @click="createOpen = true" :disabled="!!createDisabledReason" :title="createDisabledReason">
                                <Plus class="size-4" />
                                Add your first matter
                            </Button>
                        </div>
                    </div>
                </XyzTransition>
            </div>

            <SharedMattersProcedureLibrary v-model:open="procedureLibraryOpen" />

            <!-- Delete confirmation. Controlled rather than trigger-wrapped, because
                 it is now opened from two places: the selection bar and a card's
                 menu — and it names what it is about to destroy. -->
            <AlertDialog v-model:open="delete_open" @update:open="(v: boolean) => { if (!v) deleteTargets = []; }">
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {{ deleteTargets.length }} matter{{ deleteTargets.length === 1 ? '' : 's' }}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes
                            <template v-if="deleteTargets.length === 1">“{{ deleteTargets[0]?.name }}”</template>
                            <template v-else>the selected matters</template>
                            and every deadline computed for {{ deleteTargets.length === 1 ? 'it' : 'them' }}. This can't be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
                        <Button variant="destructive" :disabled="deleting || isOffline" @click="deleteSelectedMatters">
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
                        <DialogTitle>Rename matter</DialogTitle>
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

            <!-- Compact two-step create flow. The full-page flow at
                 /main/matters/create is still reachable directly and unchanged. -->
            <SharedMattersCreateMatterDialog v-model:open="createOpen" />

            <XyzTransition xyz="fade down">
                <div v-if="selection.active"
                    class="fixed p-3 w-full bottom-0 lg:bottom-0 flex flex-col items-center justify-center z-30">
                    <div
                        class="bg-background p-3 rounded border shadow-sm space-x-2 justify-between flex flex-row w-full lg:max-w-md">
                        <div class="flex flex-row items-center text-xs gap-2">
                            <div
                                class="grid place-items-center size-6 text-xs text-primary-foreground rounded-full bg-primary">
                                {{ selection.selected.length }}</div>

                            of {{ matters?.items?.length }} selected
                        </div>

                        <div class="flex flex-row gap-2 items-center">
                            <Button size="sm" @click="selection.selected = [...matters.items]" variant="secondary">Select All</Button>

                            <Button
                                size="icon" variant="destructive" aria-label="Delete selected matters"
                                :disabled="selection.selected.length === 0"
                                @click="askDelete(selection.selected)"
                            >
                                <Trash />
                            </Button>
                            <Button size="icon" @click="resetSelection" variant="secondary" aria-label="Cancel selection">
                                <X />
                            </Button>
                        </div>
                    </div>
                </div>
            </XyzTransition>
        </div>
    </div>
</template>

<script setup lang="ts">
import { vOnLongPress } from '@vueuse/components'
import { useMediaQuery } from '@vueuse/core';
import {
    Scale, SortAsc, SortDesc, Check, Trash, Trash2, X, Plus, Search, ChevronLeft, ChevronRight,
    ListChecks, WifiOff, FolderOpen, Pencil, CheckSquare, RefreshCw, Loader2,
    CircleDot, CircleCheck, Archive,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
    deleteMatter, updateMatter, setMatterStatus, matterStatusOf,
    type MatterStatus,
} from '~/services/matters';
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue';
import { storeToRefs } from 'pinia';
import { useMattersStore } from '@/stores/matters';
import { useDashboardStore } from '~/stores/dashboard';
import { Capacitor } from "@capacitor/core";
import { Haptics } from "@capacitor/haptics";

const { isOffline } = useNetwork();
const { _offlineFallback } = storeToRefs(useMattersStore());
const { hasPermission } = usePermissions();

const activePlan = usePlanActive();
// Why a button is blocked, or undefined when it's actionable. Drives both
// :disabled and :title so an expired subscription makes creation inaccessible.
const createDisabledReason = computed(() => {
  if (isOffline.value) return 'Requires internet connection';
  if (!activePlan.value?.active) return 'Your subscription has expired — renew to add matters';
  return undefined;
});

const triggerSelectionHaptic = async () => {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.selectionChanged()
  } catch (e) {
    console.warn("Haptics failed:", e)
  }
}

definePageMeta({
  layout: 'default'
})

const [DefinePaginationTemplate, ReusePaginationTemplate] = createReusableTemplate();

// All first, then the lifecycle in order — the same shape as the engagements
// filter row, so the two lists read the same way.
const statusFilters: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
];

const sortOptions: { value: string; label: string; asc: boolean }[] = [
    { value: '-created', label: 'Created (Newest)', asc: false },
    { value: 'created', label: 'Created (Oldest)', asc: true },
    { value: '-updated', label: 'Updated (Newest)', asc: false },
    { value: 'updated', label: 'Updated (Oldest)', asc: true },
    { value: 'name', label: 'Name (A-Z)', asc: true },
    { value: '-name', label: 'Name (Z-A)', asc: false },
];

const procedureLibraryOpen = ref(false);
const createOpen = ref(false);

const router = useRouter();
const mattersStore = useMattersStore();
const dashboardStore = useDashboardStore();
const { result: matters, loading, sort, query, selection, activeTab, statusFilter } = storeToRefs(mattersStore);

// Precomputed Set for O(1) selection lookups in template
const selectedIds = computed(() => new Set(selection.value.selected.map((p: any) => p.id)));

// Precomputed urgency map to drive visual differentiation without per-render deadline scanning
const matterUrgencies = computed(() => {
    const map = new Map<string, 'overdue' | 'complete' | 'active'>();
    const now = new Date();
    for (const matter of matters.value?.items ?? []) {
        const deadlines = matter?.expand?.deadlines;
        if (!deadlines?.length) { map.set(matter.id, 'active'); continue; }
        const hasOverdue = deadlines.some((d: any) => d.status === 'pending' && new Date(d.date) < now);
        if (hasOverdue) { map.set(matter.id, 'overdue'); continue; }
        map.set(matter.id, deadlines.every((d: any) => d.status === 'fulfilled') ? 'complete' : 'active');
    }
    return map;
});

// ── Right-click menus ───────────────────────────────────────────────────────
// The vault's model, and now the engagements grid's: everything you can do to a
// matter is described once as an action list (`MenuAction`) and rendered into
// whichever menu is asking, so a card's menu and the empty-space menu can never
// drift apart from each other or from the buttons in the header.
//
// A menu opened on a card that is part of a live selection acts on the whole
// selection; opened on any other card it acts on that card alone and leaves the
// selection untouched — right-clicking to rename one thing should not silently
// redefine what is selected.
//
// Touch has no context menu at all: reka's trigger arms a long-press of its own,
// which would land on top of the long-press that starts a selection here (and can
// leave the body pointer-events lock behind when dismissed — see CLAUDE.md). A
// finger selects first and uses the action bar, as it does everywhere else.
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
const ctxTarget = ref<any>(null);

// Menus and dialogs are separate overlay layers: opening the second while the
// first is still closing makes them race for the body scroll lock.
const defer = (fn: () => void) => setTimeout(fn, 0);

// ── Status ─────────────────────────────────────────────────────────────────
// Direct manipulation, mirroring the engagements grid. A closure REASON is not
// asked for here — that is what the status dialog on the matter's own page is
// for — so an existing reason is left as it stands rather than blanked.
const STATUS_ACTIONS: { status: MatterStatus; label: string; icon: any }[] = [
    { status: 'active', label: 'Reopen matter', icon: CircleDot },
    { status: 'closed', label: 'Close matter', icon: CircleCheck },
    { status: 'archived', label: 'Archive matter', icon: Archive },
];

const savingStatus = ref(false);

async function setStatusFor(list: any[], status: MatterStatus) {
    if (list.length === 0 || savingStatus.value) return;
    savingStatus.value = true;
    let failed = 0;
    for (const m of list) {
        try {
            await setMatterStatus(m.id, status);
        } catch (e) {
            failed++;
            console.error(e);
        }
    }
    savingStatus.value = false;
    resetSelection();
    await mattersStore.fetchMatters(true);
    if (failed > 0) toast.error(`${failed} matter${failed === 1 ? '' : 's'} could not be updated.`);
    else toast.success(list.length === 1 ? `Matter ${status === 'active' ? 'reopened' : status}.` : `${list.length} matters ${status === 'active' ? 'reopened' : status}.`);
}

// ── Rename ─────────────────────────────────────────────────────────────────
const renameTarget = ref<any>(null);
const renameValue = ref('');
const renaming = ref(false);

function askRename(m: any) {
    defer(() => { renameTarget.value = m; renameValue.value = m?.name ?? ''; });
}

async function submitRename() {
    const name = renameValue.value.trim();
    if (!name || !renameTarget.value || renaming.value) return;
    renaming.value = true;
    try {
        await updateMatter(renameTarget.value.id, { name });
        renameTarget.value = null;
        await mattersStore.fetchMatters(true);
    } catch (e: any) {
        toast.error(e?.message || 'Could not rename the matter.');
    } finally {
        renaming.value = false;
    }
}

function toggleMembership(matter: any) {
    selection.value.active = true;
    mattersStore.toggleSelectionFor(matter);
}

/** What this card's right-click menu offers. */
function actionsFor(matter: any): MenuAction[] {
    const many = selectedIds.value.has(matter.id) && selection.value.selected.length > 1;
    const targets = many ? [...selection.value.selected] : [matter];
    const suffix = many ? ` (${targets.length})` : '';
    const out: MenuAction[] = [];

    if (!many) {
        const alone = selectedIds.value.has(matter.id) && selection.value.selected.length === 1;
        out.push({
            id: 'open', label: 'Open', icon: FolderOpen,
            run: () => router.push(`/main/matters/matter/${matter.id}`),
        });
        out.push({
            id: 'rename', label: 'Rename', icon: Pencil, shortcut: alone ? 'F2' : undefined,
            run: () => askRename(matter),
        });
    }

    // Only the states it isn't already in — an action that would do nothing is
    // noise. On a multi-selection all three are offered, since the targets differ.
    let first = true;
    for (const a of STATUS_ACTIONS) {
        if (!many && matterStatusOf(matter) === a.status) continue;
        out.push({
            id: `status-${a.status}`, label: `${a.label}${suffix}`, icon: a.icon,
            divider: first && out.length > 0, run: () => setStatusFor(targets, a.status),
        });
        first = false;
    }

    out.push({
        id: 'select', label: selectedIds.value.has(matter.id) ? 'Deselect' : 'Select',
        icon: CheckSquare, divider: true, run: () => toggleMembership(matter),
    });

    out.push({
        id: 'delete', label: `Delete${suffix}`, icon: Trash2, danger: true, divider: true,
        shortcut: selectedIds.value.has(matter.id) ? 'Del' : undefined,
        run: () => askDelete(targets),
    });
    return out;
}

/**
 * What can be done to the page rather than to any one card — the menu on empty
 * space, which is where creating belongs: a new matter is aimed at *here*, and
 * every other menu on this screen is aimed at a card.
 */
const surfaceActions = computed<MenuAction[]>(() => {
    const out: MenuAction[] = [];
    if (hasPermission('canCreateMatters')) {
        out.push({
            id: 'new',
            // The reason rides in the label, because a greyed row with no reason
            // is a dead end (the vault's disabled-Paste pattern).
            label: createDisabledReason.value ? `Add matter — ${createDisabledReason.value.toLowerCase()}` : 'Add matter',
            icon: Plus,
            disabled: !!createDisabledReason.value,
            run: () => defer(() => { createOpen.value = true; }),
        });
    }
    out.push({ id: 'procedures', label: 'Procedures', icon: Scale, run: () => defer(() => { procedureLibraryOpen.value = true; }) });
    if (matters.value?.items?.length) {
        out.push({
            id: 'select-all', label: 'Select all', icon: CheckSquare, divider: true,
            run: () => { selection.value.active = true; selection.value.selected = [...matters.value.items]; },
        });
        if (selection.value.active) {
            out.push({ id: 'clear', label: 'Clear selection', icon: X, run: resetSelection });
        }
    }
    if (hasActiveFilters.value) {
        out.push({ id: 'clear-filters', label: 'Clear filters', icon: Search, divider: true, run: clearFilters });
    }
    out.push({ id: 'refresh', label: 'Refresh', icon: RefreshCw, divider: true, run: () => { mattersStore.fetchMatters(true); } });
    return out;
});

// ── Filters ────────────────────────────────────────────────────────────────
// Whether the list is being narrowed at all. An empty grid means two different
// things — nothing exists, or nothing survived the filter — and the page used to
// say "No matters yet" for both. It defaults to the Active filter, so a firm
// whose files are all closed was told it had no matters at all.
const hasActiveFilters = computed(() => query.value.trim().length > 0 || statusFilter.value !== 'all');

function clearFilters() {
    query.value = '';
    statusFilter.value = 'all';
}

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
    if (isTyping(e.target) || delete_open.value || renameTarget.value || createOpen.value || procedureLibraryOpen.value) return;
    if (e.key === 'Escape' && selection.value.active) { resetSelection(); return; }
    const list = selection.value.selected;
    if (!list.length) return;
    if (e.key === 'Delete') { e.preventDefault(); askDelete(list); return; }
    const only = list.length === 1 ? list[0] : null;
    if (e.key === 'F2' && only) { e.preventDefault(); askRename(only); }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

const delete_open = ref(false);
const deleting = ref(false);
// What the open confirmation is about. The selection bar fills this with the
// whole selection; a right-click menu fills it with whatever it was aimed at, so
// deleting one matter no longer requires selecting it first.
const deleteTargets = ref<any[]>([]);

function askDelete(list: any[]) {
    if (list.length === 0) return;
    deleteTargets.value = [...list];
    // Let the menu finish closing before the dialog mounts: two overlays whose
    // open/close overlap fight over the body scroll lock (see CLAUDE.md).
    defer(() => { delete_open.value = true; });
}

// Guards against click firing immediately after long-press activates selection
let selectionJustActivated = false;

function activateSelectionWith(e: PointerEvent, matter: any) {
    // A right-press belongs to the context menu. vueuse's long-press timer does
    // not filter by button, so without this a held right-click would open the
    // menu AND drop the page into selection mode behind it.
    if (e.button === 2 || e.buttons === 2) return;
    selectionJustActivated = true;
    mattersStore.activateSelectionWith(matter);
    triggerSelectionHaptic();
    setTimeout(() => { selectionJustActivated = false; }, 50);
}

const toggleSelectionMode = () => {
    if (selection.value.active) {
        resetSelection();
    } else {
        selection.value.active = true;
    }
}

const resetSelection = () => {
    mattersStore.resetSelection();
}

onMounted(async () => {
    await mattersStore.fetchMatters(false);
    await mattersStore.ensureSubscribed();
});

const sortLabel = computed(() => {
    switch (sort.value) {
        case 'created':   return { label: 'Created (Oldest)', asc: true };
        case '-created':  return { label: 'Created (Newest)', asc: false };
        case 'updated':   return { label: 'Updated (Oldest)', asc: true };
        case '-updated':  return { label: 'Updated (Newest)', asc: false };
        case 'name':      return { label: 'Name (A-Z)', asc: true };
        case '-name':     return { label: 'Name (Z-A)', asc: false };
        default:          return { label: 'Created (Newest)', asc: false };
    }
})

const visiblePages = computed(() => {
    if (!matters.value?.totalPages) return [];

    const totalPages = matters.value.totalPages;
    const currentPage = mattersStore.page;
    const delta = 2;
    const pages: number[] = [1];

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    if (rangeStart > 2) pages.push(-1);
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push(-1);
    if (totalPages > 1) pages.push(totalPages);

    return pages;
})

watch(sort, () => {
    mattersStore.page = 1;
    mattersStore.fetchMatters();
});

watch(activeTab, () => {
    mattersStore.page = 1;
    mattersStore.fetchMatters();
})

watch(statusFilter, () => {
    mattersStore.page = 1;
    mattersStore.fetchMatters();
})

watch(query, () => {
    mattersStore.page = 1;
    mattersStore.fetchMatters();
});

const onMatterTap = (matter: any) => {
    if (selectionJustActivated) return;

    if (selection.value.active) {
        const exists = selection.value.selected.find((p: any) => p.id === matter.id);
        if (exists) {
            selection.value.selected = selection.value.selected.filter((p: any) => p.id !== matter.id);
            if (selection.value.selected.length === 0) selection.value.active = false;
        } else {
            selection.value.selected.push(matter);
        }
        triggerSelectionHaptic();
        return;
    }
    router.push(`/main/matters/matter/${matter.id}`);
}

const deleteSelectedMatters = async () => {
    if (deleteTargets.value.length === 0) return;

    // A spinner on the dialog's own button rather than the list's loading flag,
    // which blanks the grid out from under the dialog.
    deleting.value = true;
    let failed = 0;
    for (const matter of deleteTargets.value) {
        try {
            await deleteMatter(matter.id);
        } catch (e) {
            failed++;
            console.error(e);
        }
    }

    const attempted = deleteTargets.value.length;
    delete_open.value = false;
    deleting.value = false;
    deleteTargets.value = [];

    resetSelection();
    // Re-sync from the server so a partial failure leaves an accurate list.
    await Promise.all([
        mattersStore.fetchMatters(true),
        dashboardStore.fetchStatistics(true)
    ]);

    if (failed > 0) toast.error(`${failed} of ${attempted} matter${attempted === 1 ? '' : 's'} could not be deleted.`);
    else toast.success(attempted === 1 ? 'Matter deleted.' : `${attempted} matters deleted.`);
}

</script>
