<template>
    <div class="flex flex-col gap-5 lg:p-5 lg:w-[95vw] w-full h-full overflow-y-scroll">
        <div class="flex flex-col h-full w-full">
            <DefineSearchFilterTemplate>
                <div class="flex flex-row items-center gap-2 w-full">
                    <InputGroup class="bg-background lg:w-fit">
                        <InputGroupInput v-model="query" placeholder="Search..." />
                        <InputGroupAddon>
                            <Search />
                        </InputGroupAddon>
                        <InputGroupAddon v-if="query.length > 0" align="inline-end">
                            {{ projects.totalItems }} results
                        </InputGroupAddon>
                    </InputGroup>

                    <Drawer>
                        <DrawerTrigger>
                            <Button class="hidden lg:flex" variant="outline">
                                <span>{{ sortLabel?.label }}</span>
                                <SortAsc v-if="sortLabel.asc" />
                                <SortDesc v-else />
                            </Button>

                            <Button class="flex lg:hidden" size="icon" variant="outline">
                                <SortAsc v-if="sortLabel.asc" />
                                <SortDesc v-else />
                            </Button>
                        </DrawerTrigger>

                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Sort Projects</DrawerTitle>
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

            <div class="flex flex-col w-full h-full p-3 gap-2">

                <div class="flex flex-row items-center justify-between">
                    <span class="font-semibold text-xl">Your Projects</span>

                    <div class="flex flex-row gap-3 items-center">
                        <ReuseSearchFilterTemplate class="hidden lg:flex" />
                        <SharedProjectsCreateProject>
                            <Button>
                                <Plus /> Add Project
                            </Button>
                        </SharedProjectsCreateProject>
                    </div>
                </div>


                <ReuseSearchFilterTemplate class="lg:hidden" />


                <XyzTransition mode="out-in" xyz="fade">
                    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div v-for="i in 9" class="rounded w-full aspect-video bg-muted-foreground/20 animate-pulse">
                        </div>
                    </div>

                    <div v-else-if="projects !== null && projects?.items?.length > 0"
                        class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div :class="{ 'ring-2 ring-tertiary relative': selection.selected.find(p => p.id === project.id) }"
                            v-for="(project, index) in projects?.items">
                            <PageComponentsHomeProject
                                v-on-long-press="[(e) => { onLongPressCallbackDirective(e, project) }, { delay: 300, onMouseUp: (duration, distance, isLongPress) => { if (!isLongPress) { onProjectTap(project) } }, modifiers: { stop: true } }]"
                                :project="project" :accent-index="index" />

                            <div v-if="selection.selected.find(p => p.id === project.id)"
                                class="size-5 bg-tertiary grid place-items-center text-white absolute top-0 translate-y-[-50%] right-0 translate-x-[50%] rounded-full">
                                <Check class="size-3 stroke-3" />
                            </div>
                        </div>
                    </div>

                    <div v-else-if="projects?.items?.length === 0"
                        class="flex flex-col text-center h-full text-muted-foreground w-full items-center justify-center">
                        <CircleX class="size-24 mb-2 opacity-50" />
                        <span>You have no projects</span>
                        <span>Click
                            <SharedProjectsCreateProject>
                                <button variant="link" class="!p-0 underline text-primary font-semibold">here</button>
                            </SharedProjectsCreateProject>

                            to add a deadline project
                        </span>
                    </div>
                </XyzTransition>
            </div>

            <XyzTransition xyz="fade down">
                <div v-if="selection.active"
                    class="fixed p-3 w-full bottom-[4rem] lg:bottom-0 flex flex-col  items-center justify-center">
                    <div
                        class="bg-background p-3 rounded border shadow-sm space-x-2 justify-between flex flex-row w-full lg:max-w-md">
                        <div class="flex flex-row items-center text-xs gap-2">
                            <div
                                class="grid place-items-center size-6 text-xs text-primary-foreground rounded-full bg-primary">
                                {{ selection.selected.length }}</div>

                            of {{ projects?.items?.length }} selected
                        </div>

                        <div class="flex flex-row gap-2 items-center">
                            <Button size="sm" @click="selection.selected = projects.items" variant="secondary">Select
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
                                            project and its deadlines.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <Button @click="deleteSelectedProjects" variant="destructive">Delete</Button>
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
import { deleteProject } from '~/services/projects';
import { storeToRefs } from 'pinia';
import { useProjectsStore } from '~/stores/projects';

const [DefineSearchFilterTemplate, ReuseSearchFilterTemplate] = createReusableTemplate();

const longPressedDirective = shallowRef(false)

const projectsStore = useProjectsStore();
const { result: projects, loading, sort, query, selection } = storeToRefs(projectsStore);

function onLongPressCallbackDirective(e: PointerEvent, project: any) {
    longPressedDirective.value = true
    projectsStore.activateSelectionWith(project);
}

function resetDirective() {
    longPressedDirective.value = false
}

const delete_open = ref(false);

const resetSelection = () => {
    projectsStore.resetSelection();
}

onMounted(async () => {
    projectsStore.ensureSubscribed();
    await projectsStore.fetchProjects(false);
});

const sortLabel = computed(() => {
    switch (sort.value) {
        case 'created':
            return { label: 'Date Created', asc: true };
        case '-created':
            return { label: 'Date Created', asc: false };
        case 'Deadlines_via_project.date':
            return { label: 'Nearest Deadline', asc: true };
        case '-name':
            return { label: 'Nearest Deadline', asc: false };
    }
})

watch(sort, () => {
    projectsStore.fetchProjects();
});

watch(query, () => {
    projectsStore.fetchProjects();
});

const onProjectTap = (project: any) => {
    if (selection.value.active) {
        const exists = selection.value.selected.find(p => p.id === project.id);

        if (exists) {
            selection.value.selected = selection.value.selected.filter(p => p.id !== project.id);

            if (selection.value.selected.length === 0) {
                selection.value.active = false;
            }
        } else {
            selection.value.selected.push(project);
        }
        return;
    }

    useRouter().push(`/main/projects/project/${project.id}`);
}

const deleteSelectedProjects = async () => {
    if (selection.value.selected.length === 0) return;

    loading.value = true;
    for (const project of selection.value.selected) {
        try {
            await deleteProject(project.id);

            // Show toast notification
            toast.success('Selected projects deleted successfully.');
        } catch (e) {
            console.error(e);
            // toast.error('Failed to delete selected projects.');
        }
    }

    delete_open.value = false;
    loading.value = false;

    // TODO: Fix the issue and restart this section
    resetSelection();
    await projectsStore.fetchProjects(true);
}

</script>