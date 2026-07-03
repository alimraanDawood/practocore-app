<script setup lang="ts">
import { RefreshCw, Briefcase } from 'lucide-vue-next';
import type { ComplianceObligation } from '~/services/engagements';

const props = defineProps<{ obligation: ComplianceObligation }>();

const engagement = computed(() => props.obligation.expand?.engagement);

function openEngagement() {
  if (engagement.value?.id) navigateTo(`/main/engagements/${engagement.value.id}`);
}
</script>

<template>
  <div class="flex flex-col gap-2 p-3 border rounded-lg bg-background">
    <div class="flex flex-row items-start gap-2">
      <RefreshCw class="size-4 mt-0.5 text-muted-foreground shrink-0" />
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-medium truncate">{{ obligation.label }}</p>
          <Badge variant="outline" class="capitalize shrink-0 text-[10px]">{{ obligation.recurrence }}</Badge>
        </div>
        <button
          v-if="engagement"
          type="button"
          class="flex flex-row items-center gap-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground w-fit"
          @click.stop="openEngagement"
        >
          <Briefcase class="size-3 shrink-0" />
          <span class="truncate">{{ engagement.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
