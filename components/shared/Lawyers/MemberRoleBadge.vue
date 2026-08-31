<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { getOrganisationRoleString } from './members'

// The professional title, which now carries the permission bundle.
//
// This component used to be keyed on `admin | lawyer | paralegal | staff` — four
// values the backend has never persisted — while columns.ts passed it a rendered
// LABEL ("Senior Associate"). Every lookup missed, so every badge fell through to
// the unstyled fallback. It is keyed on the role KEY now, and takes the firm's
// own label when there is one, because a firm may rename its titles.
const props = defineProps<{ role: string; label?: string }>()

const CLASSES: Record<string, string> = {
  partner: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900',
  senior_associate: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900',
  associate: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-900',
  paralegal: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900',
  intern: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
}

// A firm-defined role has no colour of its own, and inventing one per key would
// give the same title a different colour in two firms. Neutral is the honest
// default.
const badgeClass = computed(() => CLASSES[props.role] ?? 'bg-muted text-muted-foreground border-border')
const text = computed(() => props.label || getOrganisationRoleString(props.role))
</script>

<template>
  <Badge variant="outline" :class="['text-xs font-medium', badgeClass]">
    {{ text }}
  </Badge>
</template>
