<template>
  <div :class="{ wrapperClass: true, 'ring-2 ring-primary': store.selectedDeadline?.id == d.id  }" class="flex flex-col px-3 py-2 rounded border min-w-56 bg-background">
    <div class="flex items-start gap-2">
      <div class="flex-1">
        <div class="font-semibold text-sm truncate ibm-plex-serif">{{ d.name || 'Deadline' }}</div>
        <div class="text-xs text-muted-foreground">+{{ days }} days</div>
        <div class="mt-1 flex gap-1">
          <span v-if="hasFieldConds" class="text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700">Field</span>
          <span v-if="hasConditional" class="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-700">Conditional</span>
        </div>
      </div>
      <div class="flex flex-row items-center gap-1">
        <Button size="icon" variant="ghost" class="size-5" @click.stop="onEdit">
          <Pencil class="size-3" />
        </Button>

        <Button size="icon" variant="destructive" class="size-5" @click.stop="onDelete">
          <Trash class="size-3" />
        </Button>
        
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useTemplateEditorStore, type Deadline } from '~/stores/templateEditor'
import { Pencil, Trash } from 'lucide-vue-next';
const props = defineProps<{ data: { deadline: Deadline } }>()
const store = useTemplateEditorStore()
const d = computed(() => props.data.deadline)
const days = computed(() => d.value.offset?.days ?? 0)

const hasFieldConds = computed(() => (d.value.conditions?.length || 0) > 0)
const hasConditional = computed(() => !!d.value.offset?.conditional && (d.value.offset?.conditional?.rules?.length || 0) > 0)

const wrapperClass = computed(() => {
  const both = hasFieldConds.value && hasConditional.value
  if (both) return 'border-pink-500 dark:border-pink-900'
  if (hasConditional.value) return 'border-orange-505 dark:border-orange-900'
  if (hasFieldConds.value) return 'border-purple-500 dark:border-purple-900'
  return 'border-blue-500 dark:border-blue-900'
})

function onEdit() { store.selectNode(d.value.id) }
function onDelete() { store.deleteDeadline(d.value.id) }
</script>
