<template>
  <div v-if="!shown" class="fixed splash top-0 left-0 flex flex-col items-center justify-center h-[100dvh] w-screen bg-primary text-white z-50">
    <Vue3Lottie :animationData="SplashJSON" :height="150" :loop="false" @on-complete="closeAnimation" />
      <Loader2 class="animate-spin size-5" :class="{ 'opacity-0': !showLoader }" v-if="showLoader" />
    <div class="flex flex-row items-center justify-center text-center text-white/70 text-xs absolute bottom-0 p-3">Powered by Fiika Tech Solutions Limited</div>
  </div>
</template>

<script setup>
import { Loader2 } from 'lucide-vue-next'
import { Vue3Lottie } from 'vue3-lottie';
import SplashJSON from '@/assets/animations/splash.json';

const { $gsap } = useNuxtApp();

onMounted(() => {
})

const shown = ref(false);

const closeAnimation = () => {
  const tl = $gsap.timeline({ onComplete: () => { shown.value = true } });

  tl.to('.splash', { y: '100%', duration: 1, ease: 'Power1.inOut' });
}

const showLoader = ref(false);
</script>