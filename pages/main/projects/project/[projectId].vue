<template>
    <div class="flex flex-col w-full h-full">
        <div class="flex flex-row lg:hidden w-full items-center justify-between p-3 border-b">
            <Button @click="$router.go(-1)" size="icon" variant="ghost">
                <ArrowLeft />
            </Button>
            
            <Button size="icon" variant="secondary">
                <Bell />
            </Button>
        </div>

        <div class="flex flex-col p-3 bg-background border-b w-full">
            <span class="font-semibold text-lg">{{ project?.name }}</span>

            <div class="flex flex-row gap-2">
                <span class="text-xs">Created: {{ dayjs(project?.created).format('DD/MM/YYYY') }}</span>
            </div>
        </div>

        <div class="flex flex-col h-full w-full overflow-y-scroll">
            <div class="flex flex-col w-full bg-muted">
                <Calendar @highlight-clicked="toggleDeadlineView" :highlights="project?.expand?.deadlines?.map((d, index) => ({ id: d.id, date: d.date, class: badgeAccentClasses(index, d.completed), completed: d.completed, index: index }))" :weekday-format="'short'" class=" w-full" />
            </div>

            <div class="flex flex-col bg-background gap-3 border-t p-3 h-full">
                <SharedDeadlineViewDeadline :deadline="deadline" :index="index" v-for="deadline, index in project?.expand?.deadlines">
                    <div class="flex text-left flex-row border p-3 gap-3" :class="accentClasses(index, deadline?.completed)">
                        <CalendarIcon class="size-4" />
    
                        <div class="flex flex-col gap-1">
                            <span class="font-semibold text-sm">{{ deadline.name }}</span>
                            <span class="text-sm font-semibold">{{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY") }}</span>
    
                            <Badge v-if="deadline.completed === false && (new Date() < new Date(deadline.date))" :class="badgeAccentClasses(index)"><Clock /> PENDING</Badge>
                            <Badge v-else-if="deadline.completed === false && (new Date() > new Date(deadline.date))" :class="badgeAccentClasses(index)"><XCircle /> MISSED</Badge>
                            <Badge v-else-if="deadline.completed === true" :class="badgeAccentClasses(index)"><CheckCircle /> COMPLETED</Badge>
                        </div>
                    </div>
                </SharedDeadlineViewDeadline>
            </div>
        </div>

        <div class="p-5 fixed bottom-0 right-0">
            <Button size="icon">
                <Plus />
            </Button>
        </div>

        <SharedDeadlineViewDeadline v-model:open="viewDeadlineOpen" :index="d_index" :deadline="deadline"></SharedDeadlineViewDeadline>
    </div>
</template>

<script setup>
import { Plus, CalendarIcon, XCircle, CheckCircle, Clock, Bell, ArrowLeft, Proportions } from 'lucide-vue-next';
import { getProject, subscribeToDeadline, subscribeToProject, unsubscribeToAllDeadlines, unsubscribeToProject } from '~/services/projects';
import dayjs from 'dayjs';
import { Calendar } from '@/components/ui/calendar_enhanced';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';
import { toast } from 'vue-sonner';

const viewDeadlineOpen = ref(false);
const deadline = ref(null);
const d_index = ref(0);

dayjs.extend(utc);
dayjs.extend(timezone);

const toggleDeadlineView = (deadlineId) => {
    const _deadline = project.value.expand.deadlines.find(d => d.id === deadlineId);

    if(_deadline) {
        deadline.value = _deadline;
        d_index.value = project.value.expand.deadlines?.indexOf(_deadline);
        viewDeadlineOpen.value = true;
    }
}

definePageMeta({
    layout: 'no-mobile-nav'
});


const project = ref(null);

const accentClasses = (accentIndex) => {
    const accentMap = {
        0: 'bg-accent-1/10 text-accent-1 border-accent-1',
        1: 'bg-accent-2/10 text-accent-2 border-accent-2',
        2: 'bg-accent-3/10 text-accent-3 border-accent-3',
        3: 'bg-accent-4/10 text-accent-4 border-accent-4'
    };
    return accentMap[accentIndex % 4];
};

const badgeAccentClasses = (accentIndex, completed) => {
    const accentMap = {
        0: completed ? 'bg-accent-1/10 text-accent-1 border-2 border-accent-1' : 'bg-accent-1 !text-accents-foreground data-[selected]:!bg-accent-1 hover:bg-accent-1 data-[selected]:hover:!bg-accent-1',
        1: completed ? 'bg-accent-2/10 text-accent-2 border-2 border-accent-2' : 'bg-accent-2 !text-accents-foreground data-[selected]:!bg-accent-2 hover:bg-accent-2 data-[selected]:hover:!bg-accent-2',
        2: completed ? 'bg-accent-3/10 text-accent-3 border-2 border-accent-3' : 'bg-accent-3 !text-accents-foreground data-[selected]:!bg-accent-3 hover:bg-accent-3 data-[selected]:hover:!bg-accent-3',
        3: completed ? 'bg-accent-4/10 text-accent-4 border-2 border-accent-4' : 'bg-accent-4 !text-accents-foreground data-[selected]:!bg-accent-4 hover:bg-accent-4 data-[selected]:hover:!bg-accent-4'
    };

    return accentMap[accentIndex % 4];
}

onMounted(async () => {
    project.value = await getProject(useRoute().params.projectId, {  });

    subscribeToProject(project?.value?.id, reloadProject);

    for(let deadline of project.value?.deadlines) {
        subscribeToDeadline(deadline, useDebounceFn(reloadProject));
    }
});

const reloadProject = async () => {
    try {
        project.value = await getProject(useRoute().params.projectId, {  });
        console.log("Updated!")
    } catch(e) {
        console.error(e);
    }
}

onBeforeUnmount(() => {
    unsubscribeToProject(project?.value?.id);
    unsubscribeToAllDeadlines();
});
</script>