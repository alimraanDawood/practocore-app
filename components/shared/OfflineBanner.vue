<template>
  <div
    v-if="isOffline && isNative"
    class="flex flex-row items-center gap-2 bg-amber-500 text-white text-xs py-1.5 px-3 border-b border-amber-600"
  >
    <WifiOff class="size-3.5 shrink-0" />
    <span class="font-medium">You're offline — showing cached data</span>
  </div>
</template>

<script setup lang="ts">
import { WifiOff } from 'lucide-vue-next';
import { Capacitor } from '@capacitor/core';

const { isOffline } = useNetwork();
const isNative = Capacitor.isNativePlatform();
</script>
