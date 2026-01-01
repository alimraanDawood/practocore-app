<template>
    <div class="flex flex-col gap-5 lg:p-5 lg:w-[95vw] w-full h-full overflow-y-hidden">
        <div class="flex flex-col h-full w-full">
            <DefineSearchFilterTemplate>
                <div class="flex flex-row items-center gap-2 w-full px-3">
                    <InputGroup class="bg-background lg:w-fit">
                        <InputGroupInput v-model="query" placeholder="Search..." />
                        <InputGroupAddon>
                            <Search />
                        </InputGroupAddon>
                        <InputGroupAddon v-if="query.length > 0" align="inline-end">
                            {{ matters.totalItems }} results
                        </InputGroupAddon>
                    </InputGroup>

                    <Dialog>
                        <DialogTrigger>
                            <Button class="hidden lg:flex" variant="outline">
                                <span>{{ sortLabel?.label }}</span>
                                <SortAsc v-if="sortLabel?.asc" />
                                <SortDesc v-else />
                            </Button>

                            <Button class="flex lg:hidden" size="icon" variant="outline">
                                <SortAsc v-if="sortLabel?.asc" />
                                <SortDesc v-else />
                            </Button>
                        </DialogTrigger>

                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Sort Matters</DialogTitle>
                            </DialogHeader>

                            <div class="flex flex-col space-y-3 w-full p-3">
                                <RadioGroup :model-value="sort" @update:model-value="v => sort = v">
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="created" value="created" />
                                        <SortAsc class="size-4" />
                                        <Label for="created">Date Created (Oldest First)</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="-created" value="-created" />
                                        <SortDesc class="size-4" />
                                        <Label for="-created">Date Created (Newest First)</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="updated" value="updated" />
                                        <SortAsc class="size-4" />
                                        <Label for="updated">Last Updated (Oldest First)</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="-updated" value="-updated" />
                                        <SortDesc class="size-4" />
                                        <Label for="-updated">Last Updated (Newest First)</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="name" value="name" />
                                        <SortAsc class="size-4" />
                                        <Label for="name">Name (A-Z)</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="-name" value="-name" />
                                        <SortDesc class="size-4" />
                                        <Label for="-name">Name (Z-A)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DefineSearchFilterTemplate>

            <div class="flex flex-col w-full h-full gap-2">
                <div class="flex flex-row items-center p-3 justify-between">
                    <span class="font-semibold text-xl ibm-plex-serif">Your Matters</span>

                    <div class="flex flex-row gap-3 items-center">
                        <ReuseSearchFilterTemplate class="hidden lg:flex" />
                        <SharedMattersCreateMatter :no-stepper="true" @created="mattersStore.fetchMatters(true)">
                            <Button>
                                <Plus /> Add Matter
                            </Button>
                        </SharedMattersCreateMatter>
                    </div>
                </div>


<!--                <ReuseSearchFilterTemplate class="lg:hidden" />-->

                <div v-if="getSignedInUser()?.organisation" class="flex flex-row border-b p-3 pb-0 gap-3" role="tablist" aria-label="Templates tabs">
                    <button
                        role="tab"
                        :aria-selected="activeTab === 'all'"
                        :class="['text-sm pb-1 border-b-4', activeTab === 'all' ? 'font-semibold border-primary' : 'border-transparent']"
                        @click="setTab('all')"
                    >
                        All
                    </button>
                    <button
                        role="tab"
                        :aria-selected="activeTab === 'organisation'"
                        :class="['text-sm pb-1 border-b-4', activeTab === 'organisation' ? 'font-semibold border-primary' : 'border-transparent']"
                        @click="setTab('organisation')"
                    >
                        Organisation
                    </button>
                    <button
                        role="tab"
                        :aria-selected="activeTab === 'private'"
                        :class="['text-sm pb-1 border-b-4', activeTab === 'private' ? 'font-semibold border-primary' : 'border-transparent']"
                        @click="setTab('private')"
                    >
                        Private
                    </button>
                </div>

                <XyzTransition mode="out-in" xyz="fade">
                    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
                        <div v-for="i in 12" class="rounded w-full aspect-video bg-muted-foreground/20 animate-pulse">
                        </div>
                    </div>

                    <template v-else-if="matters !== null && matters?.items?.length > 0 ">
                        <div class="flex flex-col w-full h-full overflow-y-scroll">
                            <div
                                class="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
                                <div :class="{ 'ring-2 ring-tertiary relative': selection.selected.find(p => p.id === matter.id) }" class="h-fit ring-1 ring-border rounded-lg"
                                    v-for="(matter, index) in matters?.items">
                                    <PageComponentsHomeMatter
                                        v-on-long-press="[(e) => { onLongPressCallbackDirective(e, matter) }, { delay: 300, onMouseUp: (duration, distance, isLongPress) => { if (!isLongPress) { onMatterTap(matter) } }, modifiers: { stop: true } }]"
                                        :matter="matter" :accent-index="index" />

                                    <div v-if="selection.selected.find(p => p.id === matter.id)"
                                        class="size-5 bg-tertiary grid place-items-center text-white absolute top-0 translate-y-[-50%] right-0 translate-x-[50%] rounded-full">
                                        <Check class="size-3 stroke-3" />
                                    </div>
                                </div>
                            </div>

                            <!-- Pagination -->
                            <div v-if="matters.totalPages > 1" class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t">
                                <div class="text-sm text-muted-foreground">
                                    Showing {{ ((mattersStore.page - 1) * mattersStore.perPage) + 1 }} to {{ Math.min(mattersStore.page * mattersStore.perPage, matters.totalItems) }} of {{ matters.totalItems }} matters
                                </div>

                                <div class="flex flex-row items-center gap-2">
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
                                        <template v-for="(pageNum, index) in visiblePages" :key="index">
                                            <span v-if="pageNum === -1" class="px-2 text-muted-foreground">...</span>
                                            <Button
                                                v-else
                                                size="sm"
                                                :variant="pageNum === mattersStore.page ? 'default' : 'ghost'"
                                                @click="mattersStore.goToPage(pageNum)"
                                                class="min-w-[2.5rem]"
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
                                </div>
                            </div>
                        </div>
                    </template>

                    <div v-else-if="matters?.items?.length === 0"
                        class="flex flex-col text-center h-full text-muted-foreground w-full items-center justify-center">
                        <CircleX class="size-24 mb-2 opacity-50" />
                        <span>You have no matters</span>
                        <span>Click
                          <div class="w-fit inline-block">
                            <SharedMattersCreateMatter @created="mattersStore.fetchMatters(true)" class="w-fit">
                                <button variant="link" class="!p-0 underline text-primary font-semibold">here</button>
                            </SharedMattersCreateMatter>
                          </div>

                            to add a deadline matter
                        </span>
                    </div>
                </XyzTransition>
            </div>

            <XyzTransition xyz="fade down">
                <div v-if="selection.active"
                    class="fixed p-3 w-full bottom-[4rem] lg:bottom-0 flex flex-col  items-center justify-center z-30">
                    <div
                        class="bg-background p-3 rounded border shadow-sm space-x-2 justify-between flex flex-row w-full lg:max-w-md">
                        <div class="flex flex-row items-center text-xs gap-2">
                            <div
                                class="grid place-items-center size-6 text-xs text-primary-foreground rounded-full bg-primary">
                                {{ selection.selected.length }}</div>

                            of {{ matters?.items?.length }} selected
                        </div>

                        <div class="flex flex-row gap-2 items-center">
                            <Button size="sm" @click="selection.selected = matters.items" variant="secondary">Select
                                All</Button>

                            <AlertDialog v-model:open="delete_open">
                                <AlertDialogTrigger as-child>
                                    <Button size="icon" variant="destructive">
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
                                        <Button @click="deleteSelectedMatters" variant="destructive">Delete</Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button size="icon" @click="resetSelection" variant="secondary">
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
import { CircleX, SortAsc, SortDesc, Check, Trash, X, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { deleteMatter } from '~/services/matters';
import { storeToRefs } from 'pinia';
import { useMattersStore } from '@/stores/matters';
import { useDashboardStore } from '~/stores/dashboard';
import MatterTable from '~/components/shared/Matters/MatterTable/MatterTable.vue';
import { columns } from '@/components/shared/Matters/MatterTable/columns';
import {getSignedInUser} from "~/services/auth";

definePageMeta({
  layout: 'no-mobile-top-bar'
})

const [DefineSearchFilterTemplate, ReuseSearchFilterTemplate] = createReusableTemplate();

const longPressedDirective = shallowRef(false)

const mattersStore = useMattersStore();
const dashboardStore = useDashboardStore();
const { result: matters, loading, sort, query, selection, activeTab } = storeToRefs(mattersStore);

const setTab = (newVal : string) => {
    activeTab.value = newVal;
}

function onLongPressCallbackDirective(e: PointerEvent, matter: any) {
    longPressedDirective.value = true
    mattersStore.activateSelectionWith(matter);
}

function resetDirective() {
    longPressedDirective.value = false
}

const delete_open = ref(false);

const resetSelection = () => {
    mattersStore.resetSelection();
}

onMounted(async () => {
    mattersStore.ensureSubscribed();
    await mattersStore.fetchMatters(false);
});

const sortLabel = computed(() => {
    switch (sort.value) {
        case 'created':
            return { label: 'Created (Oldest)', asc: true };
        case '-created':
            return { label: 'Created (Newest)', asc: false };
        case 'updated':
            return { label: 'Updated (Oldest)', asc: true };
        case '-updated':
            return { label: 'Updated (Newest)', asc: false };
        case 'name':
            return { label: 'Name (A-Z)', asc: true };
        case '-name':
            return { label: 'Name (Z-A)', asc: false };
        default:
            return { label: 'Created (Newest)', asc: false };
    }
})

// Calculate visible page numbers for pagination
const visiblePages = computed(() => {
    if (!matters.value || !matters.value.totalPages) return [];

    const totalPages = matters.value.totalPages;
    const currentPage = mattersStore.page;
    const delta = 2; // Number of pages to show on each side of current page
    const pages: number[] = [];

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
        pages.push(-1); // -1 represents ellipsis
    }

    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
        pages.push(-1);
    }

    // Always show last page if there's more than 1 page
    if (totalPages > 1) {
        pages.push(totalPages);
    }

    return pages;
})

watch(sort, () => {
    mattersStore.page = 1; // Reset to first page when changing sort
    mattersStore.fetchMatters();
});

watch(activeTab, () => {
    mattersStore.page = 1; // Reset to first page when changing tab
    mattersStore.fetchMatters();
    console.log(activeTab.value);
})

watch(query, () => {
    mattersStore.page = 1; // Reset to first page when searching
    mattersStore.fetchMatters();
});

const onMatterTap = (matter: any) => {
    if (selection.value.active) {
        const exists = selection.value.selected.find(p => p.id === matter.id);

        if (exists) {
            selection.value.selected = selection.value.selected.filter(p => p.id !== matter.id);

            if (selection.value.selected.length === 0) {
                selection.value.active = false;
            }
        } else {
            selection.value.selected.push(matter);
        }
        return;
    }
    console.log("Matter")
    useRouter().push(`/main/matters/matter/${matter.id}`);
}

const deleteSelectedMatters = async () => {
    if (selection.value.selected.length === 0) return;

    loading.value = true;
    for (const matter of selection.value.selected) {
        try {
            await deleteMatter(matter.id);

            // Show toast notification
            toast.success('Selected matters deleted successfully.');
        } catch (e) {
            console.error(e);
            // toast.error('Failed to delete selected matters.');
        }
    }

    delete_open.value = false;
    loading.value = false;

    // Refresh both matters list and dashboard statistics
    resetSelection();
    await Promise.all([
        mattersStore.fetchMatters(true),
        dashboardStore.fetchStatistics(true)
    ]);
}

</script>