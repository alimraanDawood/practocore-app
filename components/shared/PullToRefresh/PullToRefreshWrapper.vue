<template>
  <div
    ref="containerRef"
    class="relative w-full h-full overflow-y-scroll"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Pull Indicator -->
    <SharedPullToRefreshPullIndicator
      v-if="isMobile"
      :pull-distance="pullDistance"
      :pull-state="pullState"
      :threshold="threshold"
    />

    <!-- Page Content with Pull Transform -->
    <div
      :style="contentStyle"
      class="w-full h-full"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { usePullToRefresh } from '~/composables/usePullToRefresh'

const {
  isMobile,
  pullState,
  pullDistance,
  scrollContainerRef,
  threshold,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd
} = usePullToRefresh()

const containerRef = ref<HTMLElement | null>(null)

// Set scroll container ref for composable
watchEffect(() => {
  scrollContainerRef.value = containerRef.value
})

// Content transform during pull
const contentStyle = computed(() => {
  if (pullState.value === 'idle' || pullState.value === 'refreshing') {
    return {
      transform: 'translateY(0)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }

  return {
    transform: `translateY(${pullDistance.value}px)`,
    transition: 'none'
  }
})
</script>
