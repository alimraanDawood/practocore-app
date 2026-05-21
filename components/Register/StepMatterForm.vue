<template>
  <div class="flex flex-col flex-1 p-6">
    <!-- v-show instead of v-if preserves the form's internal state on back-nav -->
    <PageComponentsOnboardingSoloScratchMatter
      ref="scratchMatterRef"
      :mode="store.creationMode"
      @calculated="onCalculated"
    />
  </div>
</template>

<script setup lang="ts">
import { useRegisterStore, type CalculatorResult } from '~/stores/register'

const store = useRegisterStore()

const scratchMatterRef = ref()

const canProceed = computed(() => scratchMatterRef.value?.canSubmit ?? false)

const handleNext = async () => {
  // Triggers the child's internal submit — navigation happens via @calculated
  await scratchMatterRef.value?.triggerSubmit()
}

const onCalculated = (payload: CalculatorResult) => {
  store.calculatorResult = payload
  navigateTo('/auth/register/deadline-reveal')
}

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
onMounted(() => {
  store.stepFooterLabel = 'Calculate Preview'
  store.stepNextAction = handleNext
})
</script>
