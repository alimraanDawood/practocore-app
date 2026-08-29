<template>
    <button
        :class="[
            'flex flex-col w-full text-left p-3 gap-3 rounded-lg',
            urgency === 'overdue' ? 'bg-destructive/10' : 'bg-muted'
        ]"
        @mouseenter="prefetchMatter(matter.id)"
        @touchstart="prefetchMatter(matter.id)"
        @focus="prefetchMatter(matter.id)"
    >

        <div class="flex flex-row items-center gap-2 w-full min-w-0">
            <span class="font-semibold truncate">{{ matter?.name }}</span>
            <!-- A closed file is reachable through the status filter, so it has to
                 announce itself in the list rather than look like live work. -->
            <Badge v-if="status !== 'active'" variant="outline" class="shrink-0 text-[10px] px-1.5">
                {{ MATTER_STATUS_LABELS[status] }}
            </Badge>
        </div>
        <span>{{ deadlineText }}</span>

        <div class="flex flex-col gap-2">

            <div class="flex flex-row items-center justify-between">
                <span id="completion-label" class="font-bold text-xs">Completion</span>
                <span class="font-bold text-xs">{{ deadlineCompletion }}%</span>
            </div>

            <Progress
                class="h-1"
                :model-value="deadlineCompletion"
                aria-labelledby="completion-label"
            />
        </div>

        <div v-if="matter?.expand?.deadlines?.filter(d => !d.completed).length !== 0" class="flex flex-row text-sm gap-1 items-center">
            <Clock class="size-4" />
            <span><span class="font-bold">{{ nextDeadLineText }}</span> to the next deadline</span>
        </div>

        <div v-else class="flex flex-row text-sm gap-1 items-center">
            <CheckCircle class="size-4" />
            <span>All Deadlines Met</span>
        </div>

        <div v-if="matter?.expand?.members && matter.expand.members.length > 0" class="flex flex-row items-center justify-between pt-2 border-t border-border/50 gap-2">
            <span class="text-xs text-muted-foreground">Members</span>
            <SharedAvatarStack class="ml-auto" :members="matter.expand.members" :max-visible="3" />
            <Badge variant="outline" v-if="matter?.applications?.length > 0">
              {{ matter?.applications?.length }}
              Application{{ matter?.applications?.length > 1 ? 's' : '' }}
            </Badge>
        </div>
    </button>
</template>

<script setup>
import { Clock, CheckCircle } from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { usePrefetch } from '~/composables/usePrefetch';
import { matterStatusOf, MATTER_STATUS_LABELS } from '~/services/matters';

dayjs.extend(relativeTime);

const { prefetchMatter } = usePrefetch();

const props = defineProps({
    matter: {
        type: Object,
        required: true
    },
    accentIndex: {
        type: Number,
        required: true
    },
    urgency: {
        type: String,
        default: 'active'
    },
});

const status = computed(() => matterStatusOf(props.matter));

const deadlineText = computed(() => {
    let deadlineCount = props.matter.expand.deadlines.filter(d => (d.status === 'pending')).length;
    return `${deadlineCount} upcoming deadline${deadlineCount !== 1 ? 's' : ''}`;
});

const deadlineCompletion = computed(() => {
    const total = props.matter.deadlines.length;
    if (total === 0) return 0;
    const deadlineCount = props.matter.expand.deadlines.filter(d => (d.status === 'fulfilled')).length;

    return Number(((deadlineCount / total) * 100).toFixed(1));
});

const nextDeadLineText = computed(() => {
    let deadlines = props.matter.expand.deadlines?.filter(d => d.status === 'pending');
    if(deadlines.length > 0) {
        return `${dayjs().from(deadlines?.at(0)?.date, true)}`;
    }

    return `Completed`
})
</script>