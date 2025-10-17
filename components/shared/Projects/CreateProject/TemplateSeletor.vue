<template>
    <div class="flex flex-col gap-3">
        <InputGroup>
            <InputGroupInput v-model="query" placeholder="Search..." />
            <InputGroupAddon>
                <Search />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
                {{ filteredTemplates.length }} result{{ filteredTemplates.length === 1 ? '' : 's' }}
            </InputGroupAddon>
        </InputGroup>

        <div class="flex flex-col p-3 border overflow-y-scroll rounded-lg h-[30vh] gap-2">
            <button @click="selectTemplate(template)"
                class="border p-2 flex flex-row w-full text-left rounded items-center"
                :class="{ 'bg-primary/10 text-primary ring ring-primary border-primary': template?.id === modelValue?.id }"
                v-for="template in filteredTemplates" :key="template.id">
                <span class="w-full">{{ template.name }}</span>

                <Check v-if="template.id === modelValue?.id" class="size-4" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Search, Check } from 'lucide-vue-next';
import type { RecordModel } from 'pocketbase';
import { getTemplates } from '~/services/templates';

const props = defineProps(['modelValue']);
const emits = defineEmits(['update:modelValue']);

const templates = ref([] as RecordModel[]);
const query = ref('');

const filteredTemplates = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return templates.value;
    return templates.value.filter(t => (t.name ?? '').toLowerCase().includes(q));
});

onMounted(async () => {
    templates.value = (await getTemplates(1, 10, { filter: `name ~ '${query.value}'` })).items;
});

const selectTemplate = (template: RecordModel) => {
    if(template?.template?.fields) {
        emits('update:modelValue', {id: template.id, fields: template?.template?.fields});
        return;
    }

    emits('update:modelValue', {id: template.id, fields: []});
}
</script>