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
                            <div
                                role="list"
                                aria-label="Matters"
                                class="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 h-full gap-3 p-3 content-start overflow-y-scroll">

                                <div
                                    v-for="(matter, index) in matters?.items"
                                    :key="matter.id"
                                    role="listitem"
                                    :aria-selected="selection.active ? selectedIds.has(matter.id) : undefined"
                                    :class="{
                                        'ring-2 ring-tertiary relative': selectedIds.has(matter.id),
                                        'ring-destructive/50': !selectedIds.has(matter.id) && matterUrgencies.get(matter.id) === 'overdue',
                                    }"
                                    class="h-fit ring-1 ring-border rounded-lg"
                                    v-on-long-press="[(e) => activateSelectionWith(e, matter), { delay: 300, modifiers: { stop: true } }]"
                                    @click="onMatterTap(matter)"
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

                            <div class="hidden sm:block">
                                <ReusePaginationTemplate />
                            </div>
                        </div>
                    </template>

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
                            <Button size="sm" @click="selection.selected = matters.items" variant="secondary">Select All</Button>

                            <AlertDialog v-model:open="delete_open">
                                <AlertDialogTrigger as-child>
                                    <Button size="icon" variant="destructive" aria-label="Delete selected matters">
                                        <Trash />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your
                                            matter and its deadlines.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <Button @click="deleteSelectedMatters" variant="destructive" :disabled="isOffline">Delete</Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
import { Scale, SortAsc, SortDesc, Check, Trash, X, Plus, Search, ChevronLeft, ChevronRight, ListChecks, WifiOff } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { deleteMatter } from '~/services/matters';
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

const statusFilters: { value: string; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' },
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

const delete_open = ref(false);

// Guards against click firing immediately after long-press activates selection
let selectionJustActivated = false;

function activateSelectionWith(e: PointerEvent, matter: any) {
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
    useRouter().push(`/main/matters/matter/${matter.id}`);
}

const deleteSelectedMatters = async () => {
    if (selection.value.selected.length === 0) return;

    loading.value = true;
    for (const matter of selection.value.selected) {
        try {
            await deleteMatter(matter.id);
            toast.success('Selected matters deleted successfully.');
        } catch (e) {
            console.error(e);
        }
    }

    delete_open.value = false;
    loading.value = false;

    resetSelection();
    await Promise.all([
        mattersStore.fetchMatters(true),
        dashboardStore.fetchStatistics(true)
    ]);
}

</script>
