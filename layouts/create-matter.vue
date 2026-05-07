<template>
  <div class="flex flex-col w-full h-dvh bg-background">
    <!-- Top bar -->
    <div class="flex flex-row items-center px-3 sm:px-5 h-14 border-b shrink-0 gap-2 sm:gap-4">
      <!-- Left: close + title -->
      <div class="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button variant="ghost" size="icon" class="-ml-1 shrink-0" @click="store.handleClose">
          <X class="size-4" />
        </Button>
        <span class="font-semibold text-sm hidden sm:block">Create Matter</span>
        <Separator orientation="vertical" class="h-5 mx-1 hidden md:block" />
      </div>

      <!-- Center: step indicator -->
      <div class="flex-1 flex items-center gap-1.5 min-w-0">
        <span class="text-xs text-muted-foreground shrink-0 hidden md:block">Step {{ store.stepIndex }}:</span>
        <component :is="stepIcon" class="size-3.5 shrink-0 text-primary hidden sm:block" />
        <span class="font-semibold text-sm truncate">{{ store.stepName }}</span>
      </div>

      <!-- Right: next hint + actions -->
      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <!-- Mobile: step count -->
        <span class="text-xs text-muted-foreground sm:hidden font-medium tabular-nums">
          {{ store.stepIndex }}/{{ store.stepCount }}
        </span>

        <!-- Desktop: next step hint -->
        <div class="text-xs text-muted-foreground hidden lg:flex items-center gap-1 mr-1">
          <span>Next:</span>
          <span class="font-medium text-foreground">{{ store.nextStepName ?? '—' }}</span>
        </div>

        <!-- Desktop: back button -->
        <Button
          variant="ghost"
          size="sm"
          class="hidden sm:flex gap-1"
          @click="store.handleBack"
          :disabled="store.stepIndex <= 1"
        >
          <ChevronLeft class="size-4" />
          Back
        </Button>

        <!-- Desktop: continue/create button -->
        <Button
          size="sm"
          class="hidden sm:flex gap-1.5"
          @click="store.handleNext"
          :disabled="!store.canProceed || store.loading"
          :aria-busy="store.loading"
        >
          <Loader2 v-if="store.loading" class="size-3.5 animate-spin" />
          {{ store.isLastStep ? 'Create Matter' : 'Continue' }}
        </Button>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="w-full h-0.5 bg-muted shrink-0">
      <div
        class="h-full bg-primary transition-all duration-500 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col items-center">
      <div class="w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <slot />
      </div>
    </div>

    <!-- Mobile bottom bar -->
    <div class="flex sm:hidden items-center gap-3 px-4 py-3 border-t bg-background shrink-0">
      <Button
        variant="outline"
        @click="store.handleBack"
        :disabled="store.stepIndex <= 1"
        class="flex-1 gap-1"
      >
        <ChevronLeft class="size-4" />
        Back
      </Button>
      <Button
        @click="store.handleNext"
        :disabled="!store.canProceed || store.loading"
        class="flex-1"
      >
        <Loader2 v-if="store.loading" class="size-4 animate-spin" />
        <span v-else>{{ store.isLastStep ? 'Create Matter' : 'Continue' }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  X,
  ChevronLeft,
  Loader2,
  FileText,
  Users,
  Briefcase,
  UserCheck,
  CalendarDays,
} from 'lucide-vue-next'
import { useCreateMatterStore } from '~/stores/createMatter'

const store = useCreateMatterStore()

const progress = computed(() => {
  if (!store.stepCount) return 0
  return (store.stepIndex / store.stepCount) * 100
})

const STEP_ICONS: Record<string, any> = {
  matter_type: FileText,
  parties: Users,
  matter_details: Briefcase,
  members: UserCheck,
  field_values: CalendarDays,
}

const stepIcon = computed(() => STEP_ICONS[store.currentStepId] ?? FileText)
</script>