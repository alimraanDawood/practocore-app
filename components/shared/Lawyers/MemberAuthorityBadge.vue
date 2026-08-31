<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Crown, Shield } from 'lucide-vue-next'
import { AUTHORITY_LABELS } from './members'

// Who administers the WORKSPACE — billing, membership, firm settings. Distinct
// from the professional title, which is about legal work.
//
// An ordinary member gets no badge at all. Labelling the default is noise, and a
// column where four rows in five say "Member" hides the one that does not.
defineProps<{ authority: string }>()
</script>

<template>
  <Badge
      v-if="authority === 'owner'"
      variant="outline"
      class="gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900"
  >
    <Crown class="size-3" />
    {{ AUTHORITY_LABELS.owner }}
  </Badge>
  <Badge
      v-else-if="authority === 'admin'"
      variant="outline"
      class="gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900"
  >
    <Shield class="size-3" />
    {{ AUTHORITY_LABELS.admin }}
  </Badge>
  <span v-else class="text-xs text-muted-foreground">—</span>
</template>
