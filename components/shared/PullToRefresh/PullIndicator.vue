<template>
  <div
    class="absolute top-0 left-0 w-full flex flex-col items-center justify-center pointer-events-none z-50"
    :style="indicatorStyle"
  >
    <div class="flex flex-row items-center gap-2 p-2 rounded-lg bg-background/80 backdrop-blur-sm border shadow-sm">
      <!-- Arrow Icon (pulling states) -->
      <ArrowDown
        v-if="pullState !== 'refreshing'"
        class="transition-transform duration-300 size-5"
        :style="arrowStyle"
      />

      <!-- Loading Spinner (refreshing state) -->
      <Loader
        v-else
        class="animate-spin size-5"
      />

      <!-- Pull Text -->
      <span class="text-sm font-medium" :class="textClass">
        {{ pullText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, Loader } from 'lucide-vue-next'

interface Props {
  pullDistance: number
  pullState: 'idle' | 'pulling' | 'threshold-reached' | 'refreshing'
  threshold: number
}

const props = defineProps<Props>()

// Progress percentage (0-1)
const pullProgress = computed(() => {
  return Math.min(props.pullDistance / props.threshold, 1)
})

// Indicator container style
const indicatorStyle = computed(() => {
  const height = Math.min(props.pullDistance, 100)
  const opacity = props.pullDistance > 0 ? 1 : 0

  return {
    height: `${height}px`,
    opacity,
    transition: props.pullState === 'refreshing' ? 'none' : 'opacity 0.2s'
  }
})

// Arrow transform based on progress
const arrowStyle = computed(() => {
  const rotation = pullProgress.value * 180
  const scale = 1 + pullProgress.value * 0.3

  return {
    transform: `rotate(${rotation}deg) scale(${scale})`
  }
})

// Text content based on state
const pullText = computed(() => {
  switch (props.pullState) {
    case 'pulling':
      return 'Pull to refresh'
    case 'threshold-reached':
      return 'Release to refresh'
    case 'refreshing':
      return 'Refreshing...'
    default:
      return ''
  }
})

// Text color based on state
const textClass = computed(() => {
  if (props.pullState === 'threshold-reached') {
    return 'text-primary'
  }
  if (props.pullState === 'refreshing') {
    return 'text-primary'
  }
  return 'text-muted-foreground'
})
</script>
