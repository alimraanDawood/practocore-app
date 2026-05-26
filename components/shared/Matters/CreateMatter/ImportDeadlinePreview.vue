<template>
  <div class="flex flex-col w-full">
    <div v-if="!triggerDate" class="text-sm text-muted-foreground py-2">
      Enter a trigger date above to preview deadlines.
    </div>

    <template v-else-if="output">
      <div
        v-for="dl in output.deadlines"
        :key="dl.id"
        class="flex flex-row w-full group relative"
      >
        <!-- Timeline spine -->
        <div class="flex flex-col px-2 items-center shrink-0">
          <div class="w-1 h-5 bg-muted group-first:opacity-0" />
          <div
            class="size-8 rounded-full grid place-items-center border transition-all shrink-0"
            :class="isPinned(dl.id)
              ? 'bg-blue-500/10 text-blue-500 border-blue-500/30 dark:bg-blue-500/20'
              : dl.status === 'unavailable'
                ? 'bg-muted text-muted-foreground border-muted'
                : dl.status === 'overdue'
                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                  : 'bg-primary/10 text-primary border-primary/20'"
          >
            <Pin v-if="isPinned(dl.id)" class="size-3.5" />
            <Ban v-else-if="dl.status === 'unavailable'" class="size-3.5" />
            <Clock v-else class="size-3.5" />
          </div>
          <div class="w-1 h-full bg-muted group-last:opacity-0" />
        </div>

        <!-- Row content -->
        <div class="flex flex-col w-full justify-center gap-0.5 py-2.5 pr-2 min-w-0">
          <!-- Name + reset -->
          <div class="flex flex-row items-center justify-between gap-2">
            <span class="text-sm font-medium truncate">{{ dl.name }}</span>
            <button
              v-if="isPinned(dl.id)"
              type="button"
              class="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 shrink-0"
              @click="clearPin(dl.id)"
            >
              <X class="size-3" />Reset
            </button>
          </div>

          <!-- Date: click to open calendar directly -->
          <Popover
            v-if="dl.status !== 'unavailable'"
            :modal="true"
            :open="openId === dl.id"
            @update:open="v => openId = v ? dl.id : null"
          >
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex items-center gap-1.5 text-xs w-fit text-left group/date hover:opacity-80 transition-opacity"
                :class="isPinned(dl.id)
                  ? 'text-blue-500'
                  : dl.status === 'overdue'
                    ? 'text-destructive'
                    : 'text-muted-foreground'"
              >
                <template v-if="dl.date">
                  <span>{{ dayjs(dl.date).format('D MMM YYYY') }}</span>
                  <span class="opacity-50">·</span>
                  <span class="opacity-70">{{ dayjs(dl.date).fromNow() }}</span>
                </template>
                <span v-else>Set date</span>
                <CalendarIcon class="size-3 opacity-0 group-hover/date:opacity-40 transition-opacity ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar
                :model-value="pinnedCalValue(dl.id)"
                calendar-label="Deadline date"
                initial-focus
                @update:model-value="v => { if (v) { setPin(dl.id, v.toString()); openId = null } }"
              />
            </PopoverContent>
          </Popover>

          <span v-else class="text-xs text-muted-foreground">Unavailable</span>

          <!-- Source label -->
          <span v-if="isPinned(dl.id)" class="text-xs text-blue-500/70 flex items-center gap-1">
            <Pin class="size-3" /> Pinned manually
          </span>
          <span v-else-if="dl.date" class="text-xs text-muted-foreground/60">
            {{ offsetHint(dl.id) }}
          </span>

          <!-- Holiday / weekend warning -->
          <span
            v-if="warnedIds.has(dl.id)"
            class="text-xs text-amber-500 flex items-center gap-1 mt-0.5"
          >
            <AlertTriangle class="size-3" /> Falls on a weekend or holiday — kept as-is
          </span>
        </div>
      </div>
    </template>

    <div v-else-if="engineError" class="text-xs text-destructive py-2">
      {{ engineError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Clock, Pin, X, Ban, AlertTriangle, CalendarIcon } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDate, parseDate } from '@internationalized/date'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { DeadlineEngine } from '~/lib/deadline-engine'

dayjs.extend(relativeTime)

const props = defineProps<{
  template: any
  triggerDate: string
  fieldValues?: Record<string, any>
  modelValue: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

const openId = ref<string | null>(null)
const engineError = ref<string | null>(null)

const output = computed(() => {
  if (!props.template || !props.triggerDate) return null
  engineError.value = null
  try {
    return DeadlineEngine.generateFromDates(
      props.template,
      props.triggerDate,
      props.modelValue,
      props.fieldValues ?? {}
    )
  } catch (e: any) {
    engineError.value = e?.message ?? 'Engine error'
    return null
  }
})

const warnedIds = computed<Set<string>>(() => {
  const set = new Set<string>()
  if (!output.value) return set
  for (const w of output.value.warnings) {
    const dl = output.value.deadlines.find(d => d.name && w.startsWith(d.name))
    if (dl) set.add(dl.id)
  }
  return set
})

const isPinned = (id: string) =>
  props.modelValue[id] !== undefined && props.modelValue[id] !== ''

function pinnedCalValue(id: string) {
  const raw = props.modelValue[id]
  if (typeof raw !== 'string' || raw === '') return undefined
  try { return parseDate(raw) } catch { return undefined }
}

function setPin(id: string, date: string) {
  emit('update:modelValue', { ...props.modelValue, [id]: date })
}

function clearPin(id: string) {
  const next = { ...props.modelValue }
  delete next[id]
  emit('update:modelValue', next)
}

function offsetHint(deadlineId: string): string {
  const tDl = props.template?.data?.deadlines?.find((d: any) => d.id === deadlineId)
  if (!tDl) return ''
  const days = tDl.offset?.days ?? 0
  const depId: string = tDl.dependency?.targetId ?? '_trigger_'
  let depName = 'trigger date'
  if (depId !== '_trigger_') {
    const depDl = props.template?.data?.deadlines?.find((d: any) => d.id === depId)
    depName = depDl?.name ?? depId
  }
  return `Computed: ${days >= 0 ? '+' : ''}${days} days from ${depName}`
}
</script>
