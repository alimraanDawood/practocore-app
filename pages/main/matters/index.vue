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

                    <Drawer>
                        <DrawerTrigger>
                            <Button class="hidden lg:flex" variant="outline">
                                <span>{{ sortLabel?.label }}</span>
                                <SortAsc v-if="sortLabel?.asc" />
                                <SortDesc v-else />
                            </Button>

                            <Button class="flex lg:hidden" size="icon" variant="outline">
                                <SortAsc v-if="sortLabel?.asc" />
                                <SortDesc v-else />
                            </Button>
                        </DrawerTrigger>

                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Sort Matters</DrawerTitle>
                                <DrawerDescription>Lorem ipsum dolor sit amet consectetur adipisicing elit. Dignissimos
                                    blanditiis dolorem quos.</DrawerDescription>
                            </DrawerHeader>

                            <div class="flex flex-col space-y-3 w-full p-3">
                                <RadioGroup :model-value="sort" @update:model-value="v => sort = v">
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="created" value="created" />
                                        <SortAsc class="size-4" />
                                        <Label for="option-one">Date Created Ascending</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="-created" value="-created" />
                                        <SortDesc class="size-4" />
                                        <Label for="option-two">Date Created Descending</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="deadlines.date" value="deadlines.date" />
                                        <SortAsc class="size-4" />
                                        <Label for="option-two">Nearest Deadline</Label>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <RadioGroupItem id="-deadlines.date" value="-deadlines.date" />
                                        <SortDesc class="size-4" />
                                        <Label for="option-two">Farthest Deadline</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </DrawerContent>
                    </Drawer>
                </div>
            </DefineSearchFilterTemplate>

            <div class="flex flex-col w-full h-full gap-2">
                <div class="flex flex-row items-center p-3 justify-between">
                    <span class="font-semibold text-xl ibm-plex-serif">Your Matters</span>

                    <div class="flex flex-row gap-3 items-center">
                        <ReuseSearchFilterTemplate class="hidden lg:flex" />
                        <SharedMattersCreateMatter @created="mattersStore.fetchMatters(true)">
                            <Button>
                                <Plus /> Add Matter
                            </Button>
                        </SharedMattersCreateMatter>
                    </div>
                </div>


                <ReuseSearchFilterTemplate class="lg:hidden" />

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
                    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div v-for="i in 9" class="rounded w-full aspect-video bg-muted-foreground/20 animate-pulse">
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
import { CircleX, SortAsc, SortDesc, Check, Trash, X, Plus, Search } from 'lucide-vue-next';
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
            return { label: 'Date Created', asc: true };
        case '-created':
            return { label: 'Date Created', asc: false };
        case 'Deadlines_via_matter.date':
            return { label: 'Nearest Deadline', asc: true };
        case '-name':
            return { label: 'Nearest Deadline', asc: false };
    }
})

watch(sort, () => {
    mattersStore.fetchMatters();
});

watch(activeTab, () => {
    mattersStore.fetchMatters();
    console.log(activeTab.value);
})

watch(query, () => {
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