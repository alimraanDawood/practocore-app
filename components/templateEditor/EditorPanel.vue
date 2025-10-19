<template>
  <div class="flex flex-col w-full p-3 bg-background">
    <div v-if="!deadline" class="text-sm text-muted-foreground">Select a deadline node to edit its details.</div>

    <div v-else class="flex flex-col gap-6">
      <div class="flex flex-col w-full gap-2">
        <Input v-model="deadline.name" placeholder="Deadline name" />
        <div class="flex flex-row gap-1 items-center">
          <Checkbox v-model="deadline.dynamic" />
          <label>Dynamic</label>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Textarea v-model="deadline.description" placeholder="Description" />
        <Input v-model="deadline.action_label" placeholder="Action label" />
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1 w-full">
          <label>Input Prompt</label>
          <Input placeholder="What to prompt a user when setting date" v-model="deadline.prompts.input" />
        </div>

        <div class="flex flex-col gap-1 w-full">
          <label>Pending Prompt</label>
          <Input placeholder="Use <<date>> <<from_now>> as placeholders" v-model="deadline.prompts.pending" />
        </div>

        <div class="flex flex-col gap-1 w-full">
          <label>Fulfilled Prompt</label>
          <Input placeholder="What to prompt a user when setting date" v-model="deadline.prompts.fulfilled" />
        </div>
      </div>

      <div>
        <div class="font-semibold text-sm mb-1">Offset</div>
        <div class="grid grid-cols-2 gap-2">
          <label class="text-xs col-span-2 mb-3">Base days
            <Input type="number" min="1" v-model.number="deadline.offset.days" />
          </label>

          <div class="text-xs flex flex-row gap-1 items-center"><Checkbox v-model="deadline.offset.ignoreWeekends" /> Ignore weekends</div>
          <div class="text-xs flex flex-row gap-1 items-center"><Checkbox v-model="deadline.offset.ignoreHolidays" /> Ignore holidays</div>
          <div class="text-xs flex flex-row gap-1 items-center"><Checkbox v-model="deadline.offset.allowWeekends" /> Allow weekends</div>
          <div class="text-xs flex flex-row gap-1 items-center"><Checkbox v-model="deadline.offset.allowHolidays" /> Allow holidays</div>
          <div class="text-xs flex flex-row gap-1 items-center"><Checkbox v-model="deadline.offset.includeFirst" /> Include first day</div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <div class="font-semibold text-sm">Conditional Offsets</div>
          <Button @click="addCondRule" size="icon" variant="secondary" class="size-5"><PlusIcon class="size-3" /></Button>
        </div>

        <div v-if="!deadline.offset.conditional" class="text-xs text-muted-foreground mt-1">No conditional rules.</div>
        <div v-else class="flex flex-col gap-2 mt-2">
          <div v-for="(r, idx) in deadline.offset.conditional.rules" :key="idx" class="border rounded p-2">
            <ConditionBuilder v-model:conditions="r.conditions" :fields="fields" />
            <div class="flex flex-col gap-2 mt-2">
              <span class="text-xs">Days</span>
              <div class="flex flex-row gap-1 items-center">
                <Input type="number" min="1" v-model.number="r.days" />
                <Button @click="removeCondRule(idx)" size="icon" variant="destructive" ><TrashIcon /> </Button>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs">Default days</span>
            <input type="number" min="1" v-model.number="deadline.offset.conditional.default" class="input w-24" />
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <div class="font-semibold text-sm">Activation Conditions</div>
          <Button @click="addActivationCond" size="icon" variant="secondary" class="size-5"><PlusIcon class="size-3" /></Button>
        </div>
        <ConditionBuilder v-model:conditions="deadline.conditions" :fields="fields" />
      </div>

      <div>
        <div class="flex items-center justify-between">
          <div class="font-semibold text-sm">Reminders</div>
          <button class="btn btn-xs" @click="addReminder">Add Reminder</button>
        </div>
        <div class="flex flex-col gap-2 mt-2">
          <div v-for="(r, i) in deadline.reminders" :key="r.id" class="border rounded p-2">
            <div class="flex flex-col gap-2">
              <Input v-model="r.title" placeholder="Title" />

              <Select v-model="r.priority">
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="`Select reminder priority`" />
                </SelectTrigger>
  
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Select reminder priority</SelectLabel>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Textarea v-model="r.body" placeholder="Body (use <<first_name>> <<deadline_date>> )" />
              <label class="text-xs"><input type="checkbox" v-model="r.escalate" /> Escalate</label>
              <label class="text-xs">Offset days <input type="number" v-model.number="r.offset" class="input w-24" /></label>
              <div class="flex flex-col gap-2 col-span-2">
                <div class="text-xs flex flex-row items-center gap-1"><Switch :value="r.channels.includes('MAIL')" @update:model-value="v => { if(v) { r.channels.push('MAIL') } else { r.channels   = r.channels.filter(c => c == 'MAIL') } }" /> MAIL</div>
                <div class="text-xs flex flex-row items-center gap-1"><Switch :value="r.channels.includes('APP')" @update:model-value="v => { if(v) { r.channels.push('APP') } else { r.channels     = r.channels.filter(c => c == 'APP') } }" /> APP</div>
                <div class="text-xs flex flex-row items-center gap-1"><Switch :value="r.channels.includes('ALARM')" @update:model-value="v => { if(v) { r.channels.push('ALARM') } else { r.channels = r.channels.filter(c => c == 'ALARM') } }" /> ALARM</div>
                <button class="btn btn-xs ml-auto text-red-500" @click="removeReminder(i)">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTemplateEditorStore } from '~/stores/templateEditor'
import ConditionBuilder from './ConditionBuilder.vue'
import { PlusIcon, TrashIcon } from 'lucide-vue-next'

const store = useTemplateEditorStore()
const { template, selectedDeadline } = storeToRefs(store)
const deadline = computed({ get: () => selectedDeadline.value, set: (v) => {} })
const fields = computed(() => template.value.fields)

// Keep the edge label/style in sync when editing offset/conditional
watch(() => [deadline.value?.id, deadline.value?.offset?.days, JSON.stringify(deadline.value?.offset?.conditional || null)], () => {
  const d = deadline.value
  if (!d) return
  const e = store.edges.find(e => e.target === d.id)
  if (e) {
    e.label = `+${d.offset?.days ?? 0}d`
    const isConditional = !!d.offset?.conditional && (d.offset?.conditional?.rules?.length || 0) > 0
    e.style = isConditional ? { ...(e.style || {}), strokeDasharray: '6 4' } : undefined
  }
})

function addCondRule() {
  if (!deadline.value) return
  deadline.value.offset.conditional = deadline.value.offset.conditional || { rules: [], default: deadline.value.offset.days }
  deadline.value.offset.conditional.rules.push({ conditions: [], days: deadline.value.offset.days })
}
function removeCondRule(idx: number) { deadline.value?.offset?.conditional?.rules.splice(idx, 1) }

function addActivationCond() {
  if (!deadline.value) return
  deadline.value.conditions = deadline.value.conditions || []
  deadline.value.conditions.push({ type: 'field', fieldId: fields.value[0]?.id || '', operator: 'equals', value: '' } as any)
}

function addReminder() {
  if (!deadline.value) return
  deadline.value.reminders = deadline.value.reminders || []
  deadline.value.reminders.push({ id: Math.random().toString(36).slice(2,8), title: 'Reminder', priority: 'moderate', escalate: false, offset: -1, channels: ['APP'] })
}
function removeReminder(i: number) { deadline.value?.reminders?.splice(i, 1) }
</script>

<style scoped>
@reference "@/assets/css/tailwind.css";
.input { @apply w-full px-2 py-1 border rounded bg-background; }
.textarea { @apply w-full px-2 py-1 border rounded min-h-20 bg-background; }
.btn { @apply px-2 py-1 border rounded bg-muted hover:bg-muted/60 text-xs; }
.btn-xs { @apply px-2 py-0.5 text-xs; }
</style>
