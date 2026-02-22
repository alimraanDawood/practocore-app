<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import type { Member } from '~/types/member'

const props = defineProps<{ role: Member['role'] }>()

const config: Record<Member['role'], { label: string; class: string }> = {
  admin: {
    label: 'Admin',
    class: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400',
  },
  lawyer: {
    label: 'Lawyer',
    class: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  },
  paralegal: {
    label: 'Paralegal',
    class: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  },
  staff: {
    label: 'Staff',
    class: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400',
  },
}

const badge = computed(() => config[props.role] ?? { label: props.role, class: '' })
</script>

<template>
  <Badge variant="outline" :class="['text-xs font-medium', badge.class]">
    {{ badge.label }}
  </Badge>
</template>