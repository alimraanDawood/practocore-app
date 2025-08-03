<script setup lang="ts">
defineProps<{
  reverse?: boolean
}>()
</script>

<template>
  <div
      class="relative flex items-center py-3 justify-center lg:px-4 h-[100dvh] lg:max-w-none lg:px-0"
      :class="{ 'flex-row-reverse': reverse }"
  >
    <div class="mx-auto h-full flex-1 lg:p-8 border-y">
      <slot />
    </div>
  </div>
</template>

<style scoped>

</style>
