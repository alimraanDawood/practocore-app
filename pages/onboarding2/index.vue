<template>
  <div class="flex flex-col w-full h-screen">
    <div class="flex flex-row w-full border-b p-3 items-center justify-between">
      <span class="font-semibold ibm-plex-serif">Solo Onboarding</span>
      <span class="text-sm text-muted-foreground">Step {{ currentStep }} of {{ totalSteps }}</span>
    </div>

    <div class="flex flex-col w-full h-full items-center px-5">
      <div class="flex flex-col w-full gap-5 border-x h-full max-w-3xl items-center justify-center p-5">

        <div v-if="currentStep === 1" class="w-full flex flex-col items-center gap-4">
          <PageComponentsOnboardingPersonaSelector v-model="persona" />

          <div class="flex w-full justify-end max-w-lg">
            <Button @click="handlePersonaContinue">Continue</Button>
          </div>
        </div>

        <div v-if="currentStep === 2" class="w-full flex flex-col items-center gap-4">
          <PageComponentsOnboardingSoloSelectMatterCreation v-model="creationMode" />

          <div class="flex w-full justify-end max-w-lg">
            <Button :disabled="!creationMode" @click="currentStep = 3">Continue</Button>
          </div>
        </div>

        <div v-show="currentStep === 3" class="w-full flex flex-col items-center gap-4">
          <PageComponentsOnboardingSoloScratchMatter
            :mode="creationMode"
            @back="currentStep = 2"
            @calculated="onCalculated"
          />
        </div>

        <div v-if="currentStep === 4" class="flex flex-col w-full gap-5 max-w-2xl">
          <div class="flex flex-col gap-1 text-center">
            <span class="font-semibold ibm-plex-serif text-xl">Your Deadline Preview</span>
            <span class="text-muted-foreground text-sm">
              {{ calculatorResult?.title }} · {{ calculatorResult?.templateName }}
            </span>
          </div>

          <div class="border rounded-lg p-4 space-y-3 text-left">
            <div class="text-xs text-muted-foreground">
              Trigger Date: {{ dayjs(calculatorResult?.triggerDate).format('D MMMM YYYY') }}
            </div>

            <div class="space-y-2">
              <div
                v-for="deadline in visibleDeadlines"
                :key="deadline.id"
                class="flex items-center justify-between border-b border-dashed py-2 last:border-0"
              >
                <span class="text-sm font-medium">{{ deadline.name }}</span>
                <span class="text-sm ibm-plex-serif">{{ dayjs(deadline.date).format('D MMMM YYYY') }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <Button variant="outline" @click="currentStep = 3">Back to Edit</Button>
            <Button @click="navigateTo('/main')">Continue to Dashboard</Button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-row w-full border-t p-3"></div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';

type CreationMode = 'SCRATCH' | 'SAMPLE';
type Persona = 'SOLO' | 'JOIN' | 'ORG';

const currentStep = ref(1);
const persona = ref<Persona>('SOLO');
const creationMode = ref<CreationMode | ''>('');
const calculatorResult = ref<any | null>(null);

const totalSteps = computed(() => persona.value === 'SOLO' ? 4 : 1);

const visibleDeadlines = computed(() => {
  return (calculatorResult.value?.output?.deadlines || []).filter((deadline: any) => deadline.status !== 'unavailable');
});

const handlePersonaContinue = () => {
  if (persona.value === 'SOLO') {
    currentStep.value = 2;
    return;
  }

  navigateTo('/onboarding');
};

const onCalculated = (payload: any) => {
  calculatorResult.value = payload;
  currentStep.value = 4;
};

definePageMeta({
  layout: 'blank'
})
</script>