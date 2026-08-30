<template>
    <button
        :class="[
            'flex flex-col w-full h-full text-left p-3 gap-3 rounded-lg',
            urgency === 'overdue' ? 'bg-destructive/10' : 'bg-muted'
        ]"
        @mouseenter="prefetchMatter(matter.id)"
        @touchstart="prefetchMatter(matter.id)"
        @focus="prefetchMatter(matter.id)"
    >

        <div class="flex items-start justify-between gap-2 w-full min-w-0">
            <span class="font-semibold truncate">{{ matter?.name }}</span>
            <!-- Always shown, like the engagement card's: a closed file reached
                 through the status filter has to announce itself rather than look
                 like live work, and a live one saying so costs nothing. -->
            <Badge :variant="statusVariant" class="shrink-0 capitalize">
                {{ MATTER_STATUS_LABELS[status] }}
            </Badge>
        </div>
        <span class="text-sm text-muted-foreground truncate">{{ deadlineText }}</span>

        <!-- Only when the file actually has a schedule: a 0% bar on a matter with
             no deadlines reads as work not done rather than work not planned. The
             engagement card hides its bar for a stage-free engagement the same way. -->
        <div v-if="hasDeadlines" class="flex flex-col gap-2">

            <div class="flex flex-row items-center justify-between">
                <span :id="completionLabelId" class="font-bold text-xs">Progress</span>
                <span class="font-bold text-xs">{{ deadlineCompletion }}%</span>
            </div>

            <Progress
                class="h-1"
                :model-value="deadlineCompletion"
                :aria-labelledby="completionLabelId"
            />
        </div>

        <!-- Three distinct states, because they mean different things to a
             lawyer: work still open, a file with nothing left on it, and a file
             that has no schedule at all. The last used to read "All Deadlines
             Met". -->
        <div v-if="nextDeadline" class="flex flex-row text-sm gap-1 items-center"
             :class="nextIsOverdue ? 'text-destructive' : ''">
            <AlertTriangle v-if="nextIsOverdue" class="size-4" />
            <Clock v-else class="size-4" />
            <span v-if="nextIsOverdue"><span class="font-bold">{{ nextDeadLineText }}</span> on the earliest open deadline</span>
            <span v-else><span class="font-bold">{{ nextDeadLineText }}</span> to the next deadline</span>
        </div>

        <div v-else-if="hasDeadlines" class="flex flex-row text-sm gap-1 items-center">
            <CheckCircle class="size-4" />
            <span>All Deadlines Met</span>
        </div>

        <div v-else class="flex flex-row text-sm gap-1 items-center text-muted-foreground">
            <CalendarOff class="size-4" />
            <span>No deadlines yet</span>
        </div>

        <div v-if="nextDeadlineDate" class="flex flex-row text-sm gap-1 items-center text-muted-foreground">
            <CalendarClock class="size-4" />
            <span>Due {{ nextDeadlineDate }}</span>
        </div>

        <div v-if="matter?.expand?.members && matter.expand.members.length > 0" class="flex flex-row items-center justify-between pt-2 border-t border-border/50 gap-2">
            <span class="text-xs text-muted-foreground">Lawyers</span>
            <SharedAvatarStack class="ml-auto" :members="matter.expand.members" :max-visible="3" />
            <Badge variant="outline" v-if="matter?.applications?.length > 0">
              {{ matter?.applications?.length }}
              Application{{ matter?.applications?.length > 1 ? 's' : '' }}
            </Badge>
        </div>
    </button>
</template>

<script setup>
import { Clock, CheckCircle, AlertTriangle, CalendarOff, CalendarClock } from 'lucide-vue-next';
import { usePrefetch } from '~/composables/usePrefetch';
import { matterStatusOf, MATTER_STATUS_LABELS } from '~/services/matters';
import {
    deadlineCountdown,
    isFulfilled,
    isOverdue,
    isOpen,
    nextOpenDeadline,
    parseDeadlineDate,
} from '~/services/deadlines/urgency';

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

// Per-card, because every card in the grid rendered the SAME static id: the
// duplicate ids were invalid, and every bar's aria-labelledby resolved to the
// first card's label.
const completionLabelId = computed(() => `matter-completion-${props.matter?.id ?? 'x'}`);

// The matter card sees the matter and its deadlines, not its applications, so
// the owner it can offer is the matter itself — enough for the projected-date
// exclusion that keeps an estimated schedule out of the overdue count.
const urgencyCtx = computed(() => ({
    owner: props.matter,
    representedRoleId: props.matter?.representing?.role_id ?? props.matter?.representing?.roleId ?? '',
}));

// Every count below is keyed off `status`, the only state the backend actually
// stores. The card used to test a `completed` field that Deadlines has never
// had: `!d.completed` was true for every row, so a file with deadlines never
// showed the completed state and a file with NO deadlines showed "All Deadlines
// Met" — a docket claiming nothing is outstanding on a matter it holds no
// schedule for.
const allDeadlines = computed(() => props.matter?.expand?.deadlines ?? []);
const hasDeadlines = computed(() => allDeadlines.value.length > 0);

// Open work, split so a missed date is never counted as "upcoming".
const openDeadlines = computed(() => allDeadlines.value.filter(isOpen));
const overdueCount = computed(() => openDeadlines.value.filter(d => isOverdue(d, urgencyCtx.value)).length);

const deadlineText = computed(() => {
    const upcoming = openDeadlines.value.length - overdueCount.value;
    const parts = [`${upcoming} upcoming deadline${upcoming !== 1 ? 's' : ''}`];
    if (overdueCount.value > 0) parts.push(`${overdueCount.value} overdue`);
    return parts.join(' · ');
});

const deadlineCompletion = computed(() => {
    // Count against the rows actually in hand. The total used to come from the
    // relation id list while the numerator came from the expand, so a filtered or
    // missing expand reported a percentage of a set the card could not see.
    const total = allDeadlines.value.length;
    if (total === 0) return 0;
    const done = allDeadlines.value.filter(isFulfilled).length;

    // A whole number, as on the engagement card — one decimal implied a precision
    // a deadline count does not have.
    return Number(((done / total) * 100).toFixed(0));
});

// The EARLIEST open deadline, not whatever the expand happened to return first —
// the countdown named an arbitrary row's date before.
const nextDeadline = computed(() => nextOpenDeadline(allDeadlines.value));
const nextIsOverdue = computed(() => !!nextDeadline.value && isOverdue(nextDeadline.value, urgencyCtx.value));

const nextDeadLineText = computed(() =>
    nextDeadline.value ? deadlineCountdown(nextDeadline.value) : ''
);

// The date under the countdown, mirroring the engagement card's target date. The
// countdown says how long; this says when — the thing a lawyer writes down.
const nextDeadlineDate = computed(() => {
    const d = parseDeadlineDate(nextDeadline.value?.date);
    return d ? d.toLocaleDateString() : '';
});

// Same mapping as the engagement card's, so the same state reads the same weight
// in both grids.
const statusVariant = computed(() => {
    switch (status.value) {
        case 'active': return 'default';
        case 'closed': return 'secondary';
        default: return 'outline';
    }
});
</script>