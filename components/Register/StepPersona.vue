<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-8 text-center">
      <div class="flex flex-col items-center gap-2 max-w-lg">
        <h1 class="text-3xl font-bold ibm-plex-serif">Welcome to PractoCore</h1>
        <p class="text-muted-foreground">
          Litigation deadline management built for East African advocates. Let's get you set up.
        </p>
      </div>
      <PageComponentsOnboardingPersonaSelector v-model="store.persona" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRegisterStore } from '~/stores/register'

const store = useRegisterStore()

const handleNext = async () => { await store.advance('persona') }

onMounted(() => {
  store.stepCanProceed = true
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = handleNext
})
onUnmounted(() => {
  store.stepCanProceed = true
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = null
})
</script>
