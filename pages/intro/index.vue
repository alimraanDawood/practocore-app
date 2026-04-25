<script setup lang="ts">
definePageMeta({
  layout: 'blank'
})
</script>
<template>
  <div class="flex flex-col md:items-center w-full h-dvh relative overflow-hidden">
    <div class="flex flex-row justify-between items-center p-3 border-b">
      <div class="flex items-center gap-2">
        <img
            src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png"
            alt="PractoCore"
            class="h-8 w-auto"
        />
        <span class="text-lg font-semibold ibm-plex-serif">PractoCore</span>
      </div>

      <SharedDarkModeSwitch />
    </div>

    <div class="flex flex-col text-foreground justify-center min-h-[65vh] z-10 p-5 gap-5 w-full md:max-w-lg md:px-8 md:gap-7">

      <span class="text-3xl md:text-4xl font-semibold ibm-plex-serif text-foreground">Never miss a litigation deadline</span>

      <span class="md:text-base md:leading-relaxed">Calculates court deadlines from Uganda's civil procedure rules and sends reminders before they're due. Your whole team sees every active matter, in real time.</span>

      <div class="flex flex-col gap-2 md:gap-3">
        <NuxtLink class="w-full" to="/auth/register">
          <Button size="lg" class="w-full">Create Account</Button>
        </NuxtLink>
        <NuxtLink class="w-full" to="/auth/login">
          <Button size="lg" variant="secondary" class="w-full">Sign In</Button>
        </NuxtLink>
      </div>
    </div>

    <img src="@/assets/img/onboarding/Star%201%20-%20dark.svg" class="fixed hidden dark:block  sm:w-[50vw] [animation-duration:20s] [animation-direction:reverse] opacity-50 bottom-0 translate-y-[35%] right-0 translate-x-[25%] animate-spin" />
    <img src="@/assets/img/onboarding/Star%201.svg" class="fixed dark:hidden  sm:w-[50vw] [animation-duration:20s] [animation-direction:reverse] opacity-50 bottom-0 translate-y-[35%] right-0 translate-x-[25%] animate-spin" />
    <img src="@/assets/img/onboarding/Star%202.svg" class="fixed    sm:w-[50vw] [animation-duration:20s] opacity-50 bottom-0 w-[85%] translate-y-[-5%] right-0 translate-x-[55%] animate-spin" />
    <img src="@/assets/img/onboarding/Group%204.svg" class="fixed sm:w-[50vw] [animation-duration:20s]  opacity-50 bottom-0 translate-y-[50%] left-0 translate-x-[-50%] animate-spin" />
  </div>
</template>
