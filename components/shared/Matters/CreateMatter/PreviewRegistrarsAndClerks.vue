<script setup lang="ts">
import {getClerks, getRegistrars} from "~/services/matters";
import { ChevronsUpDown } from 'lucide-vue-next'
import type {RecordModel} from "pocketbase";

const props = defineProps(['judges', 'court'])
const registrars = ref<RecordModel[]>([]);
const clerks = ref<RecordModel[] | any[]>([]);
const isOpen = ref(false)

onMounted(async () => {
  await fetchDetails();
});

const fetchDetails = async () => {
  registrars.value = await getRegistrars(1, 100, { filter: `court = '${props.court}'`, expand: 'court' });
  clerks.value = await getClerks(1, 100, { filter: props.judges.map(j => `judge = '${j}'`).join(' || '), expand: 'judge' });
}

watch(() => props.judges, async () => {
  await fetchDetails();
}, { deep: true });
</script>

<template>
  <Collapsible
      v-model:open="isOpen"
      class="flex w-full flex-col gap-2"
  >
    <div>
      <CollapsibleTrigger as-child>
        <button class="flex flex-row p-2 items-center border bg-muted w-full rounded-lg justify-between">
          <span class="ibm-plex-serif font-semibold text-sm">Clerks and Registrars (auto - inferred)</span>

          <ChevronsUpDown class="size-4" />
        </button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent class="flex flex-col border bg-muted rounded-lg p-3 gap-5">
        <div class="flex flex-col gap-1">
          <span class="ibm-plex-serif font-semibold text-sm">Registrars</span>
          <div class="flex flex-col divide-y">
            <div v-for="registrar in registrars.items" class="flex flex-col w-full py-1">
              <span class="text-xs">Working for: <span class="font-semibold">{{ registrar?.expand?.court?.name }}</span></span>
              <span>{{ registrar.name }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="ibm-plex-serif font-semibold text-sm">Clerk</span>
          <div class="flex flex-col divide-y">
            <div v-for="clerk in clerks.items" class="flex flex-col w-full py-1">
              <span class="text-xs">Working for: <span class="font-semibold">{{ clerk?.expand?.judge?.name }}</span></span>
              <span>{{ clerk.name }}</span>
            </div>
          </div>
        </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<style scoped>

</style>