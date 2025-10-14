<template>
  <div class="circular-progress">
    <svg 
      :width="size" 
      :height="size" 
      :viewBox="`0 0 ${viewBoxSize} ${viewBoxSize}`"
    >
      <!-- Background circle -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="backgroundColor"
        :stroke-width="strokeWidth"
      />
      <!-- Progress circle -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="progressColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        stroke-linecap="round"
        transform-origin="center"
        :transform="`rotate(-90 ${center} ${center})`"
        class="progress-ring"
      />
    </svg>
  </div>
</template>

<script>
export default {
  name: 'CircularProgress',
  props: {
    progress: {
      type: Number,
      default: 0,
      validator: (value) => value >= 0 && value <= 100
    },
    size: {
      type: [Number, String],
      default: '24px'
    },
    strokeWidth: {
      type: Number,
      default: 3
    },
    backgroundColor: {
      type: String,
      default: '#e5e7eb'
    },
    progressColor: {
      type: String,
      default: '#667eea'
    }
  },
  computed: {
    viewBoxSize() {
      return 100;
    },
    center() {
      return this.viewBoxSize / 2;
    },
    radius() {
      return (this.viewBoxSize - this.strokeWidth * 2) / 2;
    },
    circumference() {
      return 2 * Math.PI * this.radius;
    },
    dashOffset() {
      return this.circumference - (this.progress / 100) * this.circumference;
    }
  }
}
</script>

<style scoped>
.circular-progress {
  display: inline-flex;
  width: fit-content;
  height: fit-content;
}

.circular-progress svg {
  display: block;
}

.progress-ring {
  transition: stroke-dashoffset 0.5s ease;
}
</style>