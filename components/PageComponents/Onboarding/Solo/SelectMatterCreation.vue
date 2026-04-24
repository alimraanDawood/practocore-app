<script setup lang="ts">

type CreationMode = 'SCRATCH' | 'SAMPLE';

const props = defineProps<{
  modelValue?: CreationMode | '';
}>();

const emits = defineEmits<{
  (e: 'update:modelValue', value: CreationMode): void;
}>();

const option = computed(() => props.modelValue || '');

const selectMode = (value: CreationMode) => {
  emits('update:modelValue', value);
};
</script>

<template>
  <div class="flex flex-col items-center text-center gap-5 max-w-lg">
    <div class="flex flex-col items-cetner text-center gap-1">
      <span class="font-semibold ibm-plex-serif text-xl">Let's set up your first matter.</span>
      <span>Pick a real matter you're working on this week. In two minutes, you'll see every deadline PractoCore tracks for it.</span>
    </div>

    <div class="grid md:grid-cols-2 gap-2 max-w-lg">
      <button @click="selectMode('SCRATCH')" class="flex gap-4 disabled:opacity-50 flex-row items-start text-left p-3 border-2 bg-muted/30 text-muted-foreground rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': option === 'SCRATCH' }">
        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Create a matter from scratch</span>
          <span class="text-sm text-muted-foreground">(for lawyers who want to see the mechanics)</span>
        </div>
      </button>

      <button @click="selectMode('SAMPLE')" class="flex gap-4 disabled:opacity-50 flex-row items-start text-left p-3 border-2 bg-muted/30 text-muted-foreground rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': option === 'SAMPLE' }">
        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Use a sample matter</span>
          <span class="text-sm text-muted-foreground">(pre-populated Ugandan commercial recovery suit — for lawyers who want to preview the product before committing their own data)</span>
        </div>
      </button>
    </div>
  </div>
</template>