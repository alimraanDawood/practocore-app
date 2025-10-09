<template>
    <button 
        class="flex flex-col w-full text-left p-3 border gap-3"
        :class="accentClasses"
    >
        
        <span class="font-semibold truncate">{{ project?.name }}</span>
        <span>{{ deadlineText }}</span>

        <div class="flex flex-col gap-1">

            <div class="flex flex-row items-center justify-between">
                <span class="font-bold text-xs">Completion</span>

                <span class="font-bold text-xs">{{ deadlineCompletion }}%</span>
            </div>
    
            <Progress 
                class="h-1" 
                :class="progressClasses"
                :indicator="indicatorClass" 
                :model-value="deadlineCompletion" 
            />
        </div>

        <div v-if="project?.expand?.deadlines?.filter(d => !d.completed).length !== 0" class="flex flex-row text-sm gap-1 items-center">
            <Clock class="size-4" />
            <span><span class="font-bold">{{ nextDeadLineText }}</span> to the next deadline</span>
        </div>

        <div v-else class="flex flex-row text-sm gap-1 items-center">
            <CheckCircle class="size-4" />
            <span>All Deadlines Met</span>
        </div>
    </button>
</template>

<script setup>
import { Clock, CheckCircle, CheckCircle2 } from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const props = defineProps({
    project: {
        type: Object,
        required: true
    },
    accentIndex: {
        type: Number,
        required: true
    },
});

const accentClasses = computed(() => {
    const accentMap = {
        0: 'bg-accent-1/10 text-accent-1 border-accent-1',
        1: 'bg-accent-2/10 text-accent-2 border-accent-2',
        2: 'bg-accent-3/10 text-accent-3 border-accent-3',
        3: 'bg-accent-4/10 text-accent-4 border-accent-4'
    };
    return accentMap[props.accentIndex % 4];
});

const progressClasses = computed(() => {
    const accentMap = {
        0: 'bg-accent-1/10 text-accent-1',
        1: 'bg-accent-2/10 text-accent-2',
        2: 'bg-accent-3/10 text-accent-3',
        3: 'bg-accent-4/10 text-accent-4'
    };
    return accentMap[props.accentIndex % 4];
});

const indicatorClass = computed(() => {
    const accentMap = {
        0: 'bg-accent-1',
        1: 'bg-accent-2',
        2: 'bg-accent-3',
        3: 'bg-accent-4'
    };
    return accentMap[props.accentIndex % 4];
});

const deadlineText = computed(() => {
    let deadlineCount = props.project.expand.deadlines.filter(d => (d.completed === false)).length;
    return `${deadlineCount} upcoming deadline${deadlineCount !== 1 ? 's' : ''}`;
});

const deadlineCompletion = computed(() => {
    let deadlineCount = props.project.expand.deadlines.filter(d => (d.completed === true)).length;
    
    return ((deadlineCount / props.project.deadlines.length) * 100);
});

const nextDeadLineText = computed(() => {
    let deadlines = props.project.expand.deadlines?.filter(d => d.completed === false);
    if(deadlines.length > 0) {
        return `${dayjs().from(deadlines?.at(0)?.date, true)}`;
    }

    return `Completed`
})
</script>