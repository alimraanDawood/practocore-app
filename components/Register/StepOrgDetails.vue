<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <Building2 class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">Tell us about your firm</h2>
        <p class="text-muted-foreground">
          This sets up your firm's workspace. You'll invite your team after your first matter.
        </p>
      </div>

      <div class="flex flex-col gap-1.5 w-full max-w-sm">
        <label class="text-sm font-medium">Law firm name</label>
        <Input
          v-model="store.orgDetails.firmName"
          placeholder="Kato & Associates Advocates"
          class="w-full"
          @keydown.enter="canProceed && handleNext()"
        />
        <p class="text-xs text-muted-foreground">As it appears on your firm's letterhead</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Building2 } from 'lucide-vue-next'
import { useRegisterStore } from '~/stores/register'

const store = useRegisterStore()

const canProceed = computed(() => !!store.orgDetails.firmName.trim())

const handleNext = async () => {
  if (!canProceed.value) return
  await store.advance('org-details')
}

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
onMounted(() => {
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = handleNext
})
</script>
