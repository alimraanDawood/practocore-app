<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
</script>

<template>
  <div class="flex flex-col items-center justify-center-safe w-full h-full">
    <div class="flex flex-col items-center gap-2 p-3 border w-full bg-muted text-muted-foreground rounded-lg">
      <span class="text-lg font-semibold">Creating Account</span>
      <span>Give us a quick moment to set things up.</span>

      <Loader2 class="animate-spin text-primary" />
    </div>
  </div>
</template>

<style scoped>
</style>