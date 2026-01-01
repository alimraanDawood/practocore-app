<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {getJudges} from "~/services/matters";
import type {RecordModel} from "pocketbase";

const props = defineProps(['modelValue', 'court']);
const emits = defineEmits(['update:modelValue']);

const value = computed({
  get: () => props.modelValue,
  set: value => {
    emits('update:modelValue', value);
  },
})

const judges = ref<RecordModel[]>([]);

onMounted(async () => {
  judges.value = (await getJudges(1, 100, { filter: `court = '${props.court}'`, sort: 'name' }))?.items;
});

watch(() => props.court, async () => {
  value.value = []; // reset the judges
  judges.value = (await getJudges(1, 100, { filter: `court = '${props.court}'`, sort: 'name' }))?.items;
});

const valueText = computed(() => {
  const judgeNames = value?.value?.map(v => {
    const judge = judges.value?.find(j => j.id === v);

    return judge?.name
  });


  return judgeNames?.length > 2 ? `${judgeNames[0]} and ${judgeNames?.length - 1} others` : judgeNames?.join(', ');
})

</script>

<template>
  <Select v-model="value" multiple>
    <SelectTrigger class="w-full">
      <SelectValue placeholder="Select a judge">
        {{ valueText }}
      </SelectValue>
    </SelectTrigger>
    <SelectContent class="w-full" position="popper">
      <SelectGroup>
        <SelectLabel>Judges</SelectLabel>
        <SelectItem class="truncate" v-for="judge in judges" :value="judge.id">
          {{ judge.name }}
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
