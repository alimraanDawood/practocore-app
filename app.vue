<template>
  <ClientOnly>
    <SplashScreen />
  </ClientOnly>
  <NuxtLayout>

    <Toaster />
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

import SplashScreen from "~/components/shared/SplashScreen/SplashScreen.vue";
</script>