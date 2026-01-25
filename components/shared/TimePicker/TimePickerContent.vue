<template>
  <div class="flex flex-col items-center py-6">
    <!-- Time Display -->
    <div class="text-4xl font-semibold mb-6 tabular-nums">
      {{ displayHour }}:{{ minutes.toString().padStart(2, '0') }}
      <span class="text-2xl text-muted-foreground ml-1">{{ period }}</span>
    </div>

    <!-- Scrollable Selectors -->
    <div class="flex flex-row items-center gap-2 w-full max-w-[280px] px-4">
      <!-- Hours -->
      <div class="flex-1 flex flex-col items-center">
        <span class="text-xs text-muted-foreground mb-2">Hour</span>
        <div
          ref="hoursContainer"
          class="h-[180px] overflow-y-auto snap-y snap-mandatory scrollbar-hide relative"
          @scroll="onHoursScroll"
        >
          <div class="h-[60px]" />
          <button
            v-for="h in 24"
            :key="h - 1"
            :ref="el => { if (h - 1 === hours) hoursActiveRef = el as HTMLElement }"
            class="h-[60px] w-full flex items-center justify-center text-2xl snap-center transition-all"
            :class="{
              'text-primary font-semibold scale-110': h - 1 === hours,
              'text-muted-foreground/50': h - 1 !== hours
            }"
            @click="selectHour(h - 1)"
          >
            {{ formatHourDisplay(h - 1) }}
          </button>
          <div class="h-[60px]" />
        </div>
      </div>

      <!-- Separator -->
      <div class="text-3xl font-bold text-muted-foreground">:</div>

      <!-- Minutes -->
      <div class="flex-1 flex flex-col items-center">
        <span class="text-xs text-muted-foreground mb-2">Minute</span>
        <div
          ref="minutesContainer"
          class="h-[180px] overflow-y-auto snap-y snap-mandatory scrollbar-hide relative"
          @scroll="onMinutesScroll"
        >
          <div class="h-[60px]" />
          <button
            v-for="m in 60"
            :key="m - 1"
            :ref="el => { if (m - 1 === minutes) minutesActiveRef = el as HTMLElement }"
            class="h-[60px] w-full flex items-center justify-center text-2xl snap-center transition-all"
            :class="{
              'text-primary font-semibold scale-110': m - 1 === minutes,
              'text-muted-foreground/50': m - 1 !== minutes
            }"
            @click="selectMinute(m - 1)"
          >
            {{ (m - 1).toString().padStart(2, '0') }}
          </button>
          <div class="h-[60px]" />
        </div>
      </div>
    </div>

    <!-- AM/PM Toggle -->
    <div class="flex flex-row gap-2 mt-4">
      <Button
        size="sm"
        :variant="hours < 12 ? 'default' : 'outline'"
        @click="togglePeriod('AM')"
      >
        AM
      </Button>
      <Button
        size="sm"
        :variant="hours >= 12 ? 'default' : 'outline'"
        @click="togglePeriod('PM')"
      >
        PM
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { Haptics } from '@capacitor/haptics'

const props = defineProps<{
  hours: number
  minutes: number
}>()

const emit = defineEmits<{
  'update:hours': [value: number]
  'update:minutes': [value: number]
}>()

const hoursContainer = ref<HTMLElement | null>(null)
const minutesContainer = ref<HTMLElement | null>(null)
const hoursActiveRef = ref<HTMLElement | null>(null)
const minutesActiveRef = ref<HTMLElement | null>(null)

const hours = computed({
  get: () => props.hours,
  set: (val) => emit('update:hours', val)
})

const minutes = computed({
  get: () => props.minutes,
  set: (val) => emit('update:minutes', val)
})

const period = computed(() => hours.value >= 12 ? 'PM' : 'AM')

const displayHour = computed(() => {
  const h = hours.value
  if (h === 0) return 12
  if (h > 12) return h - 12
  return h
})

const formatHourDisplay = (h: number) => {
  if (h === 0) return '12'
  if (h > 12) return (h - 12).toString()
  return h.toString()
}

const triggerSelectionHaptic = async () => {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.selectionChanged()
  } catch (e) {
    // Silently fail
  }
}

let scrollTimeout: ReturnType<typeof setTimeout> | null = null

const onHoursScroll = () => {
  if (!hoursContainer.value) return

  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    const container = hoursContainer.value!
    const scrollTop = container.scrollTop
    const itemHeight = 60
    const index = Math.round(scrollTop / itemHeight)
    const clampedIndex = Math.max(0, Math.min(23, index))

    if (clampedIndex !== hours.value) {
      hours.value = clampedIndex
      triggerSelectionHaptic()
    }
  }, 50)
}

const onMinutesScroll = () => {
  if (!minutesContainer.value) return

  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    const container = minutesContainer.value!
    const scrollTop = container.scrollTop
    const itemHeight = 60
    const index = Math.round(scrollTop / itemHeight)
    const clampedIndex = Math.max(0, Math.min(59, index))

    if (clampedIndex !== minutes.value) {
      minutes.value = clampedIndex
      triggerSelectionHaptic()
    }
  }, 50)
}

const selectHour = (h: number) => {
  hours.value = h
  triggerSelectionHaptic()
  scrollToHour(h)
}

const selectMinute = (m: number) => {
  minutes.value = m
  triggerSelectionHaptic()
  scrollToMinute(m)
}

const togglePeriod = (p: 'AM' | 'PM') => {
  const currentHour = hours.value
  if (p === 'AM' && currentHour >= 12) {
    hours.value = currentHour - 12
  } else if (p === 'PM' && currentHour < 12) {
    hours.value = currentHour + 12
  }
  triggerSelectionHaptic()
  scrollToHour(hours.value)
}

const scrollToHour = (h: number) => {
  if (!hoursContainer.value) return
  hoursContainer.value.scrollTo({
    top: h * 60,
    behavior: 'smooth'
  })
}

const scrollToMinute = (m: number) => {
  if (!minutesContainer.value) return
  minutesContainer.value.scrollTo({
    top: m * 60,
    behavior: 'smooth'
  })
}

onMounted(() => {
  // Scroll to initial values
  nextTick(() => {
    scrollToHour(hours.value)
    scrollToMinute(minutes.value)
  })
})
</script>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>