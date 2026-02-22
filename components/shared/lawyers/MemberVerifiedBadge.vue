<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock } from 'lucide-vue-next'

defineProps<{ verified: boolean }>()
</script>

<template>
  <Badge
      variant="outline"
      :class="[
      'text-xs font-medium gap-1.5',
      verified
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400',
    ]"
  >
    <CheckCircle2 v-if="verified" class="h-3 w-3" />
    <Clock v-else class="h-3 w-3" />
    {{ verified ? 'Verified' : 'Pending' }}
  </Badge>
</template>