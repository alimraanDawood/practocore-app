<template>
  <div class="bg-background rounded border p-3 flex flex-row gap-2" :class="{ 'ring-2 ring-primary': store.selectedNodeId === '_date_' }">
    <div class="flex items-center gap-2">
      <CalendarIcon class="size-5 text-primary" />
      <div class="font-semibold text-sm ibm-plex-serif">Trigger Date</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useTemplateEditorStore } from '@/stores/templateEditor';
import { CalendarIcon } from 'lucide-vue-next';
// No actions; cannot delete

const store = useTemplateEditorStore();
</script>
