<template>
  <div class="flex flex-col gap-2">
    <div v-if="localConditions.length === 0" class="text-xs text-muted-foreground">No conditions. Use Add to create one.</div>
    <div v-for="(c, i) in localConditions" :key="i" class="flex flex-col w-full gap-2">
      
      <Select v-model="c.fieldId">
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="`Select field`" />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Select field</SelectLabel>
            <SelectItem v-for="f in fields" :key="f.id" :value="f.id">{{ f.label }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select v-model="c.operator">
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="`Select Condition`" />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Select Condition</SelectLabel>
            <SelectItem value="equals">equals</SelectItem>
            <SelectItem value="not_equals">not equals</SelectItem>
            <SelectItem value="in">in</SelectItem>
            <SelectItem value="not_in">not in</SelectItem>
            <SelectItem value="greater_than">greater than</SelectItem>
            <SelectItem value="less_than">less than</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Input v-if="fieldType(c.fieldId) === 'number'" type="number" v-model.number="c.value" />
      <Input v-else-if="fieldType(c.fieldId) === 'date'" type="date" v-model="c.value" />
      <Select v-else-if="fieldType(c.fieldId) === 'boolean'" v-model="c.value">
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="`Select field`" />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Select field</SelectLabel>
              <SelectItem :value="true">True</SelectItem>
              <SelectItem :value="false">False</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select v-else-if="fieldType(c.fieldId) === 'select'" v-model="c.value">
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="`Select field`" />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Select field</SelectLabel>
            <SelectItem v-for="o in fieldOptions(c.fieldId)" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Input v-else type="text" v-model="c.value" />
      <Button size="sm" variant="destructive" @click="remove(i)"><TrashIcon /> Delete</Button>
    </div>
    
    <button class="btn btn-xs w-fit" @click="add">Add Condition</button>
  </div>
</template>
<script setup lang="ts">
import { TrashIcon } from 'lucide-vue-next';
import { computed } from 'vue'
import type { TemplateField, TemplateFieldOption } from '~/stores/templateEditor'

interface Condition { type: 'field'; fieldId: string; operator: string; value: any }
const props = defineProps<{ conditions?: Condition[] | null, fields: TemplateField[] }>()
const emit = defineEmits(['update:conditions'])

const localConditions = computed({
  get: () => props.conditions || [],
  set: (v) => emit('update:conditions', v)
})

function add() {
  localConditions.value = [...localConditions.value, { type: 'field', fieldId: props.fields[0]?.id || '', operator: 'equals', value: '' }]
}
function remove(i: number) {
  const arr = localConditions.value.slice()
  arr.splice(i, 1)
  localConditions.value = arr
}

function fieldType(id: string) {
  return props.fields.find(f => f.id === id)?.type || 'text'
}
function fieldOptions(id: string): TemplateFieldOption[] {
  return props.fields.find(f => f.id === id)?.options || []
}
</script>
<style scoped>
@reference "@/assets/css/tailwind.css";
.input { @apply px-2 py-1 border rounded bg-background; }
.btn { @apply px-2 py-1 border rounded bg-muted hover:bg-muted/60 text-xs; }
.btn-xs { @apply px-2 py-0.5 text-xs; }
</style>
