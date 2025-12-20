<template>
  <Dialog>
    <DialogTrigger as-child>
      <slot/>
    </DialogTrigger>

    <DialogContent class="p-0 flex flex-col gap-0 h-[85vh] !max-w-3xl w-full overflow-hidden">
      <div class="flex flex-row p-3 border-b">
        <span class="ibm-plex-serif font-semibold">Add Application to matter</span>
      </div>
      <div class="flex flex-row w-full h-full overflow-hidden">
        <div class="flex flex-col p-5 bg-muted border-r">
          <Stepper ref="stepper" orientation="vertical" class="flex w-full max-w-md flex-col justify-start gap-10"
                   v-model="currentStep">
            <StepperItem
                v-for="step in steps"
                :key="step.step"
                v-slot="{ state }"
                class="relative flex w-full item-center gap-3"
                :step="step.step"
            >
              <StepperSeparator
                  v-if="step.step !== steps[steps.length - 1]?.step"
                  class="absolute left-[12px] top-[32px] block h-[105%] w-0.5 shrink-0 rounded-full bg-muted group-data-[state=completed]:bg-primary"
              />

              <StepperTrigger as-child>
                <Button
                    :variant="state === 'completed' || state === 'active' ? 'default' : 'outline'"
                    class="z-10 rounded-full shrink-0 size-7"
                    :class="[state === 'active' && 'ring-2 ring-ring ring-offset-2 ring-offset-background']"
                >
                  <Check v-if="state === 'completed'" class="size-5"/>
                  <Circle v-if="state === 'active'"/>
                  <Dot v-if="state === 'inactive'"/>
                </Button>
              </StepperTrigger>

              <div class="flex flex-col gap-1">
                <StepperTitle
                    :class="[state === 'active' && 'text-primary']"
                    class="text-sm font-semibold transition"
                >
                  {{ step.title }}
                </StepperTitle>
              </div>
            </StepperItem>
          </Stepper>
        </div>


        <div class="flex flex-col w-full h-full">
          <div class="flex flex-col h-full w-full p-3 overflow-y-scroll">
            <div v-if="steps[currentStep - 1]?.id === 'application_type'" class="flex flex-col w-full gap-3">
              <span class="font-semibold">Select a type</span>
              <TemplateSelector :modelValue="selectedTemplate" @template-selected="tr => selectedTemplate = tr"/>
            </div>

            <div v-else-if="steps[currentStep - 1]?.id === 'field_values'" class="flex flex-col gap-3">
              <span class="font-semibold">Field Values</span>
            </div>

            <div v-else-if="steps[currentStep - 1]?.id === 'preview'" class="flex flex-col gap-3">
              <span class="font-semibold">Preview</span>
              {{ previewOutput }}

              <Button @click="() => { previewOutput = generateOutput() }">Generate Out</Button>
            </div>
          </div>
          <div class="flex flex-row w-full p-2 border-t gap-3 justify-end">
            <Button size="sm" variant="outline">Cancel</Button>
            <Button @click="stepper?.nextStep()" size="sm">Next</Button>
            {{ stepper }}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import {Check, Circle, Dot} from 'lucide-vue-next';
import TemplateSelector from "~/components/shared/Matters/CreateMatter/TemplateSelector.vue";
import { DeadlineEngine } from "~/lib/deadline-engine/index.ts";
import {getTemplate} from "~/services/templates/index.ts";

const props = defineProps(['triggerDate', 'matter', 'deadlineId']);
const selectedTemplate = ref(null);
const matterTemplate = await getTemplate(props.matter.template);

const currentStep = ref(1);
const steps = computed(() => {
  if (selectedTemplate.value && selectedTemplate?.value?.template?.data?.fields?.length > 0) {
    return [
      {
        step: 1,
        id: 'application_type',
        title: 'Choose Application Type',
      },
      {
        step: 2,
        id: 'field_values',
        title: 'Field Values',
      },
      {
        step: 3,
        id: 'preview',
        title: 'Preview',
      },
    ]
  }

  return [
    {
      step: 1,
      id: 'application_type',
      title: 'Choose Application Type',
    },
    {
      step: 2,
      id: 'preview',
      title: 'Preview',
    },
  ]
});

const previewOutput = ref(null);
const stepper = useTemplateRef('stepper');

const generateOutput = () => {
  if(selectedTemplate.value) {
    console.log(matterTemplate?.template);
    return DeadlineEngine.applyAction(matterTemplate?.template, props.matter.state, { action: "SPAWN", meta: { targetId: props.deadlineId, template: selectedTemplate.value.template, fieldValues: {} } });
  }
  return null
}
</script>