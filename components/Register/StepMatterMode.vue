<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex items-center justify-center">
      <PageComponentsOnboardingSoloSelectMatterCreation v-model="store.creationMode" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRegisterStore } from '~/stores/register'

const store = useRegisterStore()

const canProceed = computed(() => !!store.creationMode)

const handleNext = async () => {
  if (!canProceed.value) return
  await store.advance('matter-mode')
}

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
onMounted(() => {
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = handleNext
})
onUnmounted(() => {
  store.stepCanProceed = true
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = null
})
</script>
