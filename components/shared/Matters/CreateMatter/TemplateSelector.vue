<template>
  <div class="flex flex-col gap-3">
    <InputGroup>
      <InputGroupInput v-model="query" placeholder="Search..."/>
      <InputGroupAddon>
        <Search/>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        {{ filteredTemplates.length }} result{{ filteredTemplates.length === 1 ? '' : 's' }}
      </InputGroupAddon>
    </InputGroup>

    <div v-if="loading === false && filteredTemplates.length > 0" class="flex flex-col">
      <div
           class="flex flex-col p-3 border overflow-y-scroll rounded-lg rounded-b-none h-full gap-2">
        <button type="button" @click="selectTemplate(template)"
                class="border p-2 flex flex-row w-full text-left rounded items-center"
                :class="{ 'bg-primary/10 text-primary ring ring-primary border-primary': template?.id === modelValue?.id }"
                v-for="template in filteredTemplates" :key="template.id">
          <span class="w-full">{{ template.name }}</span>

          <Check v-if="template.id === modelValue?.id" class="size-4"/>
        </button>
      </div>
      <div class="bg-muted rounded-b-lg p-2 border border-t-0 flex flex-row gap-3 items-start">
        <span class="text-sm ibm-plex-serif font-semibold w-full">More matter types coming soon</span>

        <Button type="button" variant="outline" size="xs" @click="requestTemplate">Request one</Button>
      </div>
    </div>
    <div v-else-if="loading === false && filteredTemplates.length === 0"
         class="flex flex-col p-3 border overflow-y-scroll rounded-lg h-full gap-2">
      <span class="text-center text-xs text-muted-foreground">No Templates Found</span>
    </div>
    <div v-else-if="loading === true"
         class="flex flex-col items-center justify-center p-3 border rounded-lg h-full gap-2">
      <Loader class="animate-spin size-5 text-primary"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {Search, Check} from 'lucide-vue-next';
import type {RecordModel} from 'pocketbase';
import {getTemplates} from '~/services/templates';
import {Loader} from "lucide-vue-next";

const props = defineProps(['modelValue']);
const emits = defineEmits(['update:modelValue', 'templateSelected']);

const templates = ref([] as RecordModel[]);
const query = ref('');

const filteredTemplates = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter(t => (t.name ?? '').toLowerCase().includes(q));
});

const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  templates.value = (await getTemplates(1, 20, {filter: `name ~ '${query.value}'`}, 'order')).items;
  loading.value = false;
});

const requestTemplate = () => {
  const subject = encodeURIComponent('Template Request');
  const body = encodeURIComponent(`Hi,\n\nI'd like to request a new matter type template.\n\nTemplate name: \nDescription: \n`);
  window.open(`mailto:contact@fiika.dev?subject=${subject}&body=${body}`);
};

const selectTemplate = (template: RecordModel) => {
  if (template?.template?.data?.fields) {
    emits('update:modelValue', {
      id: template.id,
      fields: template?.template?.data?.fields,
      triggerDatePrompt: template?.template?.data?.triggerDatePrompt,
      partyConfig: template?.template?.data?.parties
    });

    emits('templateSelected', template);
    return;
  }

  emits('templateSelected', template);
  emits('update:modelValue', {id: template.id, fields: [], triggerDatePrompt: template?.template?.data?.triggerDatePrompt, partyConfig: template?.template?.data?.parties});
}
</script>