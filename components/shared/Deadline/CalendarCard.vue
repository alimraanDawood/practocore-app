<template>
  <!-- Mobile: horizontal layout -->
  <div v-if="variant === 'mobile'"
       class="flex text-left flex-row border p-3 gap-3 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
    <CalendarIcon class="size-4 shrink-0 mt-0.5 text-muted-foreground" />
    <div class="flex flex-col gap-1 flex-1 min-w-0">
      <span class="font-semibold text-sm truncate">{{ deadline.name }}</span>
      <span class="text-xs text-muted-foreground truncate">{{ deadline.expand?.matter?.name }}</span>
      <span class="text-xs font-semibold">{{ dateLabel }}</span>
      <Badge :variant="badge.variant" :class="['w-fit uppercase', badge.class]">
        <component :is="badge.icon" class="size-3 mr-1" /> {{ badge.label }}
      </Badge>
    </div>
  </div>

  <!-- Desktop: vertical layout -->
  <div v-else
       class="flex flex-col p-3 border rounded-lg bg-muted hover:bg-muted/70 transition-colors cursor-pointer">
    <div class="flex flex-row items-start mb-2">
      <div class="flex flex-col flex-1 min-w-0">
        <span class="font-semibold text-sm truncate">{{ deadline.name }}</span>
        <span class="text-xs text-muted-foreground mt-0.5 truncate">{{ deadline.expand?.matter?.name || 'No matter' }}</span>
      </div>
    </div>
    <div class="flex flex-row items-center gap-2">
      <Badge :variant="badge.variant" :class="['text-xs', badge.class]">
        <component :is="badge.icon" class="size-3 mr-1" /> {{ badge.label }}
      </Badge>
      <span class="text-xs ml-auto" :class="status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'">
        {{ countdown }}
      </span>
    </div>
    <div v-if="deadline.description" class="text-xs text-muted-foreground mt-2 line-clamp-2">
      {{ deadline.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { CalendarIcon, Clock, CheckCircle, AlertCircle, CalendarClock, Users } from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { deadlineCountdown, deadlineUrgency } from '~/services/deadlines/urgency';

dayjs.extend(relativeTime);

const props = defineProps<{
  deadline: any;
  variant?: 'mobile' | 'desktop';
}>();

// Derived, never read off the column: `status` is only ever "pending" or
// "fulfilled" (internal/deadlinev2/v1bridge.go:legacyStatus), so a card that
// trusted it badged a deadline missed three weeks ago as PENDING.
const status = computed(() =>
  deadlineUrgency(props.deadline, {
    owner: props.deadline?.expand?.application ?? props.deadline?.expand?.matter ?? null,
    representedRoleId:
      props.deadline?.expand?.matter?.representing?.role_id ??
      props.deadline?.expand?.matter?.representing?.roleId ??
      '',
  })
);

// One badge per urgency, so a missed date can never wear the same badge as a
// date three weeks out, and the other side's step can never wear this firm's.
type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary';
const BADGES: Record<string, { label: string; variant?: BadgeVariant; class?: string; icon: any }> = {
  done: { label: 'Done', icon: CheckCircle },
  overdue: { label: 'Overdue', variant: 'destructive', icon: AlertCircle },
  urgent: { label: 'Due soon', variant: 'outline', class: 'border-accent-warning text-accent-warning', icon: Clock },
  theirs: { label: 'Other party', variant: 'outline', class: 'text-muted-foreground', icon: Users },
  projected: { label: 'Projected', variant: 'outline', class: 'text-muted-foreground', icon: CalendarClock },
  undated: { label: 'No date', variant: 'outline', class: 'text-muted-foreground', icon: CalendarClock },
  pending: { label: 'Pending', icon: Clock },
};

const badge = computed(() => BADGES[status.value] ?? BADGES.pending);
const dateLabel = computed(() =>
  props.deadline?.date ? dayjs(props.deadline.date).format('DD MMM YYYY') : 'No date'
);
const countdown = computed(() => deadlineCountdown(props.deadline));

</script>