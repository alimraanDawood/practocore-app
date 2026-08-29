<script lang="ts" setup>
// Review surface for the new compact "New matter" dialog
// (components/shared/Matters/CreateMatterDialog.vue), so it can be opened and
// judged side by side with the 829-line stepper it is a candidate to replace.
//
// This page is a review surface, not a feature: the two buttons open the two
// flows against the real backend, and creating from either really creates a
// matter. The old flow is mounted here unchanged, purely for comparison.
import { Layers, PanelTop } from 'lucide-vue-next';
import CreateMatter from '~/components/shared/Matters/CreateMatter/CreateMatter.vue';

definePageMeta({ layout: 'default' });

const newOpen = ref(false);
const oldOpen = ref(false);
const lastCreated = ref<any>(null);
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-col gap-1">
      <h1 class="text-lg font-semibold">Create-matter flows</h1>
      <p class="text-sm text-muted-foreground">
        Both open against the real backend. Creating from either really creates a matter.
      </p>
    </div>

    <div class="flex flex-wrap gap-3">
      <Button class="gap-1.5" @click="newOpen = true">
        <Layers class="size-4" /> New compact dialog
      </Button>
      <Button variant="outline" class="gap-1.5" @click="oldOpen = true">
        <PanelTop class="size-4" /> Existing stepper
      </Button>
    </div>

    <p v-if="lastCreated" class="text-sm text-muted-foreground">
      Last created: <span class="font-medium text-foreground">{{ lastCreated?.name }}</span>
    </p>

    <SharedMattersCreateMatterDialog v-model:open="newOpen" @created="(m) => (lastCreated = m)" />
    <CreateMatter v-model:open="oldOpen" />
  </div>
</template>
