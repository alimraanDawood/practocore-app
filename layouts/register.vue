<template>
  <div class="flex flex-col w-full h-dvh bg-background">
    <!-- Progress bar -->
    <div class="w-full h-0.5 bg-muted shrink-0">
      <div
          class="h-full bg-primary transition-all duration-700 ease-out"
          :style="{ width: `${progress}%` }"
      />
    </div>

    <!-- Header -->
    <div class="flex w-full flex-row items-center justify-between px-4 py-3 border-b shrink-0">
      <div class="flex items-center gap-2">
        <img
            src="@/assets/img/logos/Practo Core Square -- orange.png"
            alt="PractoCore"
            class="h-7 w-auto"
        />
        <span class="text-base font-semibold ibm-plex-serif">PractoCore</span>
      </div>
      <div class="flex items-center gap-2">
        <SharedDarkModeSwitch />
        <NuxtLink to="/auth/login">
          <Button variant="secondary">Sign in instead</Button>
        </NuxtLink>
      </div>
    </div>

    <!-- Step content -->
    <div class="flex flex-col w-full flex-1 items-center overflow-hidden">
      <div class="overflow-y-auto flex flex-col w-full max-w-3xl flex-1 border-x">
        <slot />
      </div>
    </div>

    <!-- Footer nav — hidden on 'creating' step -->
    <div
        v-if="showFooterNav"
        class="flex w-full items-center justify-center px-4 py-3 border-t bg-background shrink-0"
    >
      <div class="flex w-full max-w-3xl items-center gap-3 lg:justify-start justify-between">
        <!-- Back button -->
        <Button
            variant="outline"
            size="sm"
            @click="handleBack"
            :disabled="!canGoBack"
            class="shrink-0"
        >
          <ArrowLeft class="size-4" />
          <span class="hidden sm:inline ml-1.5">Back</span>
        </Button>

        <!-- Step dots -->
        <div class="flex-1 hidden md:flex items-center justify-center gap-1.5">
          <div
              v-for="(s, i) in store.dotSteps"
              :key="s"
              class="rounded-full transition-all duration-300"
              :class="
              s === currentStep
                ? 'size-2 bg-primary'
                : i < dotStepIndex
                  ? 'size-1.5 bg-primary/40'
                  : 'size-1.5 bg-muted-foreground/20'
            "
          />
        </div>

        <!-- Skip + Next -->
        <div class="flex flex-row gap-2 items-center">
          <Button
              v-if="canSkip"
              type="button"
              size="sm"
              variant="outline"
              @click="handleSkip"
          >
            Skip
          </Button>

          <Button
              size="sm"
              @click="handleNext"
              :disabled="!canProceed"
              class="shrink-0"
          >
            {{ footerNextLabel }}
            <ArrowRight class="size-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { useRegisterStore, type RegisterStep } from '~/stores/register'

const route = useRoute()
const store = useRegisterStore()

const currentStep = computed(() => route.params.step as RegisterStep)
const progress = computed(() => store.progressForStep(currentStep.value))
const dotStepIndex = computed(() => store.dotSteps.indexOf(currentStep.value))
const showFooterNav = computed(() => currentStep.value !== 'creating')
const canGoBack = computed(() => !!store.prevStepPath(currentStep.value))
const canSkip = computed(() => !!store.skipTargetPath(currentStep.value))

const canProceed = computed(() => store.stepCanProceed)
const footerNextLabel = computed(() => store.stepFooterLabel)

const handleBack = () => {
  useRouter().back()
}

const handleSkip = () => {
  const target = store.skipTargetPath(currentStep.value)
  if (target) navigateTo(target)
}

const handleNext = async () => {
  if (store.stepNextAction) {
    await store.stepNextAction()
    return
  }
  const next = store.nextStepPath(currentStep.value)
  if (next) await navigateTo(next)
}
</script>