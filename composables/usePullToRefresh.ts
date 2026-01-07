import { ref, computed, onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'

interface PullToRefreshOptions {
  threshold?: number
  maxPullDistance?: number
  resistance?: number
  disabled?: boolean
}

export const usePullToRefresh = (options: PullToRefreshOptions = {}) => {
  const {
    threshold = 80,
    maxPullDistance = 150,
    resistance = 0.5,
    disabled = false
  } = options

  // Platform detection
  const isMobile = ref(false)

  // Pull state
  const pullState = ref<'idle' | 'pulling' | 'threshold-reached' | 'refreshing'>('idle')
  const pullDistance = ref(0)

  // Touch tracking
  const startY = ref(0)
  const currentY = ref(0)
  const isDragging = ref(false)

  // Scroll container ref (set by wrapper component)
  const scrollContainerRef = ref<HTMLElement | null>(null)

  // Detect mobile platform
  onMounted(() => {
    const platform = Capacitor.getPlatform()
    isMobile.value = platform === 'android' || platform === 'ios'
  })

  // Execute page reload
  const executeRefresh = async () => {
    if (disabled || pullState.value === 'refreshing') return

    pullState.value = 'refreshing'

    try {
      // Simple page reload
      window.location.reload()
    } catch (error) {
      console.error('Refresh error:', error)
      // Reset state if reload fails
      pullState.value = 'idle'
      pullDistance.value = 0
    }
  }

  // Calculate pull distance with resistance curve
  const calculatePullDistance = (rawDistance: number): number => {
    if (rawDistance <= 0) return 0

    // Apply resistance curve - feels more natural
    const resistedDistance = rawDistance * resistance
    const maxResistance = 1 - (rawDistance / maxPullDistance) * 0.5

    return Math.min(resistedDistance * maxResistance, maxPullDistance)
  }

  // Touch event handlers
  const handleTouchStart = (e: TouchEvent) => {
    if (disabled || !isMobile.value || pullState.value === 'refreshing') return

    const container = scrollContainerRef.value
    if (!container || container.scrollTop > 0) return

    startY.value = e.touches[0].clientY
    isDragging.value = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.value || disabled || !isMobile.value) return

    currentY.value = e.touches[0].clientY
    const rawDistance = currentY.value - startY.value

    // If scrolling up, let normal scroll happen
    if (rawDistance < 0) {
      isDragging.value = false
      pullState.value = 'idle'
      pullDistance.value = 0
      return
    }

    // Calculate pull distance with resistance
    const distance = calculatePullDistance(rawDistance)
    pullDistance.value = distance

    // Update state based on threshold
    if (distance >= threshold && pullState.value !== 'threshold-reached') {
      pullState.value = 'threshold-reached'
    } else if (distance < threshold && pullState.value === 'threshold-reached') {
      pullState.value = 'pulling'
    } else if (distance > 0 && pullState.value === 'idle') {
      pullState.value = 'pulling'
    }

    // Prevent default scroll when pulling
    if (pullState.value === 'pulling' || pullState.value === 'threshold-reached') {
      e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging.value || disabled || !isMobile.value) return

    isDragging.value = false

    if (pullState.value === 'threshold-reached') {
      // Trigger refresh
      executeRefresh()
    } else {
      // Spring back to idle
      pullState.value = 'idle'
      pullDistance.value = 0
    }
  }

  return {
    isMobile,
    pullState,
    pullDistance,
    scrollContainerRef,
    isRefreshing: computed(() => pullState.value === 'refreshing'),
    isPulling: computed(() => pullState.value === 'pulling' || pullState.value === 'threshold-reached'),
    threshold,
    maxPullDistance,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    executeRefresh
  }
}
