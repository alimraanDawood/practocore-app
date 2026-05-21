<template>
  <div class="flex flex-col flex-1 min-h-full p-6 gap-6">
    <div class="flex flex-col gap-1 text-center">
      <span class="text-xs font-medium text-primary uppercase tracking-widest">
        Your deadline schedule is ready
      </span>
      <h2 class="text-2xl font-bold ibm-plex-serif">{{ store.calculatorResult?.title }}</h2>
      <p class="text-sm text-muted-foreground">{{ store.calculatorResult?.templateName }}</p>
    </div>

    <div class="flex flex-col gap-2 rounded-lg border overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b">
        <Calendar class="size-3.5 text-muted-foreground" />
        <span class="text-xs text-muted-foreground">
          Trigger date:
          {{
            store.calculatorResult?.triggerDate
              ? dayjs(store.calculatorResult.triggerDate).format('D MMMM YYYY')
              : '—'
          }}
        </span>
      </div>

      <div class="flex flex-col divide-y">
        <div
          v-for="(deadline, index) in visibleDeadlines"
          :key="deadline.id"
          class="flex items-center justify-between px-4 py-3 deadline-row"
          :style="{ '--delay': `${index * 55}ms` }"
        >
          <span class="text-sm font-medium">{{ deadline.name }}</span>
          <div class="flex flex-col items-end gap-0.5 shrink-0 ml-4">
            <span class="text-sm ibm-plex-serif tabular-nums">
              {{ deadline.date ? dayjs(deadline.date).format('D MMM YYYY') : '—' }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ deadline.date ? dayjs(deadline.date).fromNow() : '' }}
            </span>
          </div>
        </div>

        <div
          v-if="visibleDeadlines.length === 0"
          class="px-4 py-6 text-center text-sm text-muted-foreground"
        >
          No deadlines to display.
        </div>
      </div>
    </div>

    <div class="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
      <Bell class="size-3.5 mt-0.5 shrink-0" />
      <span>
        PractoCore will send you reminders 30, 14, 7, 3, and 1 day before each deadline.
        You can customise reminder rules after setup.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Calendar, Bell } from 'lucide-vue-next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useRegisterStore } from '~/stores/register'

dayjs.extend(relativeTime)

const store = useRegisterStore()

const visibleDeadlines = computed(() =>
  (store.calculatorResult?.output?.deadlines || []).filter(
    (d: any) => d.status !== 'unavailable'
  )
)

const canProceed = computed(() => visibleDeadlines.value.length > 0)

const handleNext = async () => {
  await store.advance('deadline-reveal')
}

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
onMounted(() => {
  store.stepFooterLabel = 'Looks right — set up my workspace'
  store.stepNextAction = handleNext
})
</script>

<style scoped>
.deadline-row {
  animation: deadlineIn 0.35s ease-out both;
  animation-delay: var(--delay, 0ms);
}

@keyframes deadlineIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
