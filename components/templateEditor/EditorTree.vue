<template>
    <div class="flex flex-col p-3 gap-3">
        <div class="flex flex-row items-center justify-between">
            <span class="font-semibold">Deadlines</span>

            <Button @click="addFromSelected" variant="secondary" class="size-5" size="icon">
                <PlusIcon class="size-3" />
            </Button>
        </div>

        <div class="flex flex-col gap-1">
            <Button size="sm" variant="ghost" class="flex flex-row justify-start" :class="{ 'bg-muted': store.selectedDeadline?.id == deadline?.id }" @click="store.selectNode(deadline.id)" v-for="deadline in store.template.deadlines">{{ deadline.name }}</Button>
        </div>
    </div>
</template>

<script setup>
import { PlusIcon } from 'lucide-vue-next';
import { useTemplateEditorStore } from '~/stores/templateEditor'
const store = useTemplateEditorStore()

function addFromSelected() { store.addDeadline(store.selectedNodeId || '_date_') }

</script>