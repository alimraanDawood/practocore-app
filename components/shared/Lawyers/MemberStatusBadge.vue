<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, PauseCircle, MailQuestion } from 'lucide-vue-next'

// One status column for both kinds of row.
//
// `pending` here means an invitation that has not been accepted — a different
// fact from an accepted member who has not verified their email, which is what
// the old "Pending" badge meant. Both existed on the same screen under the same
// word, in two different tabs.
const props = defineProps<{ status: string; verified?: boolean; kind?: string }>()

const state = computed(() => {
  if (props.kind === 'invitation') {
    return { label: 'Invited', icon: MailQuestion, class: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900' }
  }
  if (props.status === 'suspended') {
    return { label: 'Suspended', icon: PauseCircle, class: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900' }
  }
  if (props.verified === false) {
    return { label: 'Unverified', icon: Clock, class: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900' }
  }
  return { label: 'Active', icon: CheckCircle2, class: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900' }
})
</script>

<template>
  <Badge variant="outline" :class="['text-xs font-medium gap-1.5', state.class]">
    <component :is="state.icon" class="size-3" />
    {{ state.label }}
  </Badge>
</template>
