<template>
  <!-- Mobile: horizontal layout -->
  <div v-if="variant === 'mobile'"
       class="flex text-left flex-row border p-3 gap-3 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
    <CalendarIcon class="size-4 shrink-0 mt-0.5 text-muted-foreground" />
    <div class="flex flex-col gap-1 flex-1 min-w-0">
      <span class="font-semibold text-sm truncate">{{ deadline.name }}</span>
      <span class="text-xs text-muted-foreground truncate">{{ deadline.expand?.matter?.name }}</span>
      <span class="text-xs font-semibold">{{ dayjs(deadline.date).format("DD MMM YYYY") }}</span>
      <Badge v-if="status === 'pending'" class="w-fit">
        <Clock class="size-3 mr-1" /> PENDING
      </Badge>
      <Badge v-else-if="status === 'overdue'" variant="destructive" class="w-fit">
        <AlertCircle class="size-3 mr-1" /> OVERDUE
      </Badge>
      <Badge v-else-if="status === 'fulfilled'" class="w-fit">
        <CheckCircle class="size-3 mr-1" /> COMPLETED
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
      <Badge v-if="status === 'pending'" class="text-xs">
        <Clock class="size-3 mr-1" /> Pending
      </Badge>
      <Badge v-else-if="status === 'overdue'" variant="destructive" class="text-xs">
        <AlertCircle class="size-3 mr-1" /> Overdue
      </Badge>
      <Badge v-else-if="status === 'fulfilled'" class="text-xs">
        <CheckCircle class="size-3 mr-1" /> Done
      </Badge>
      <span class="text-xs text-muted-foreground ml-auto">{{ dayjs(deadline.date).fromNow() }}</span>
    </div>
    <div v-if="deadline.description" class="text-xs text-muted-foreground mt-2 line-clamp-2">
      {{ deadline.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { CalendarIcon, Clock, CheckCircle, AlertCircle } from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const props = defineProps<{
  deadline: any;
  variant?: 'mobile' | 'desktop';
}>();

const status = computed(() => props.deadline.status);
</script>