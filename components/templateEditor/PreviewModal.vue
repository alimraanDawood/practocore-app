<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-background border rounded-lg w-[90vw] max-w-3xl p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="font-semibold">Preview</div>
        <button class="btn btn-xs" @click="$emit('close')">Close</button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-xs">Start date <input type="date" v-model="start" class="input" /></label>
          <div class="text-xs font-semibold">Field Values</div>
          <div class="flex flex-col gap-2">
            <div v-for="f in fields" :key="f.id" class="grid grid-cols-2 gap-2 items-center">
              <div class="text-xs">{{ f.label }}</div>
              <template v-if="f.type==='number'">
                <input type="number" v-model.number="values[f.id]" class="input" />
              </template>
              <template v-else-if="f.type==='date'">
                <input type="date" v-model="values[f.id]" class="input" />
              </template>
              <template v-else-if="f.type==='boolean'">
                <select v-model="values[f.id]" class="input"><option :value="true">True</option><option :value="false">False</option></select>
              </template>
              <template v-else-if="f.type==='select'">
                <select v-model="values[f.id]" class="input"><option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option></select>
              </template>
              <template v-else>
                <input type="text" v-model="values[f.id]" class="input" />
              </template>
            </div>
          </div>
          <button class="btn btn-xs w-fit" @click="run">Calculate</button>
        </div>

        <div class="border rounded p-2">
          <div class="text-xs font-semibold mb-2">Results</div>
          <div class="flex flex-col gap-1 max-h-80 overflow-y-auto">
            <div v-for="d in deadlinesSorted" :key="d.id" class="flex items-center justify-between text-sm">
              <div>
                <div class="font-medium">{{ d.name }}</div>
                <div class="text-xs text-muted-foreground" v-if="!active[d.id]">Skipped</div>
              </div>
              <div class="text-right">
                <div v-if="dates[d.id]">{{ formatDate(dates[d.id]) }}</div>
                <div v-else class="text-xs text-muted-foreground">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useTemplateEditorStore } from '~/stores/templateEditor'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['close'])

const store = useTemplateEditorStore()
const { template } = storeToRefs(store)
const fields = computed(() => template.value.fields)
const deadlinesSorted = computed(() => template.value.deadlines.filter(d => d.id !== '_date_'))

const start = ref(dayjs().format('YYYY-MM-DD'))
const values = ref<Record<string, any>>({})
const dates = ref<Record<string, string>>({})
const active = ref<Record<string, boolean>>({})

function run() {
  const res = store.calculatePreview(start.value, values.value)
  dates.value = res.dates
  active.value = res.active
}

function formatDate(iso: string) { return dayjs(iso).format('DD MMM YYYY') }
</script>
<style scoped>
@reference "@/assets/css/tailwind.css";
.input { @apply w-full px-2 py-1 border rounded bg-background; }
.btn { @apply px-2 py-1 border rounded bg-muted hover:bg-muted/60 text-xs; }
.btn-xs { @apply px-2 py-0.5 text-xs; }
</style>
