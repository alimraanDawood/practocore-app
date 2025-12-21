<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot/>
    </DialogTrigger>

    <DialogContent class="p-0 flex flex-col gap-0 h-[85vh] !max-w-3xl w-full overflow-hidden">
      <div class="flex flex-row p-3 border-b">
        <span class="ibm-plex-serif font-semibold">Add Application to matter</span>
      </div>
      <div class="flex flex-row w-full h-full overflow-hidden">
        <div class="flex flex-col p-5 bg-muted border-r">
          <Stepper ref="stepStages" orientation="vertical" class="flex w-full max-w-md flex-col justify-start gap-10" v-model="currentStep">
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
                <StepperTitle :class="[state === 'active' && 'text-primary']" class="text-sm font-semibold transition">
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
              <form id="fieldValues" @submit="saveValues" class="flex flex-col space-y-4">
                <FormField
                    v-for="field in selectedTemplate?.template?.data?.fields || []"
                    :key="field.name"
                    :name="field.id"
                    v-slot="{ componentField }"
                >
                  <FormItem>
                    <FormLabel>{{ field.label }}</FormLabel>
                    <FormControl v-if="field.type === 'text'">
                      <Input v-bind="componentField" type="text" :placeholder="field.placeholder || ''" />
                    </FormControl>
                    <FormControl v-else-if="field.type === 'select'">
                      <Select v-bind="componentField">
                        <SelectTrigger class="w-full">
                          <SelectValue :placeholder="`Select ${field.label}`" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>{{ field.label }}</SelectLabel>
                            <SelectItem v-for="opt in field.options" :key="opt.value" :value="opt.value">
                              {{ opt.label }}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormControl v-else-if="field.type === 'boolean'">
                      <Switch :model-value="componentField.value" @update:model-value="(v) => setFieldValue(field.id, v)" />
                    </FormControl>
                    <DateInput v-else-if="field.type === 'date'" v-bind="componentField"/>
                    <span v-else class="italic text-muted-foreground">Unsupported type: {{ field.type }}</span>
                    <FormMessage/>
                  </FormItem>
                </FormField>
              </form>
            </div>

            <div v-else-if="steps[currentStep - 1]?.id === 'preview'" class="flex flex-col gap-3">
              <span class="font-semibold">Preview</span>

              <div v-if="previewError" class="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                <p class="font-bold">Failed to generate preview</p>
                <p>{{ previewError }}</p>
              </div>

              <div v-else-if="!previewOutput" class="flex items-center justify-center p-10 text-muted-foreground animate-pulse">
                Generating preview...
              </div>

              <template v-else>
                <div class="flex flex-col">
                  <div class="flex flex-row gap-3 items-center group" v-for="deadline in previewOutput?.deadlines">
                    <div class="flex flex-col items-center">
                      <div class="w-1 h-4 bg-muted border-x group-first:opacity-0"></div>
                      <div class="bg-muted border shrink-0 grid place-items-center rounded-full size-8">
                        <CalendarDays class="size-4"/>
                      </div>
                      <div class="w-1 h-4 bg-muted border-x group-last:opacity-0"></div>
                    </div>
                    <div class="flex flex-col">
                      <span class="font-semibold text-sm ibm-plex-serif">{{ deadline?.name }}</span>
                      <span class="text-sm text-muted-foreground">{{ deadline.date }}</span>
                    </div>
                  </div>
                </div>

                <div class="flex flex-row gap-3 w-full items-center">
                  <div class="h-[1px] w-full bg-muted-foreground/20"></div>
                  <span class="text-sm font-semibold text-muted-foreground ibm-plex-serif">Applications</span>
                  <div class="h-[1px] w-full bg-muted-foreground/20"></div>
                </div>

                <div class="flex flex-col" v-for="subProcess in previewOutput?.subProcesses">
                  <span class="font-semibold underline">{{ subProcess.name }}</span>
                  <div class="flex flex-row gap-3 items-center group" v-for="deadline in subProcess.output.deadlines">
                    <div class="flex flex-col items-center">
                      <div class="w-1 h-4 bg-muted border-x group-first:opacity-0"></div>
                      <div class="bg-muted border shrink-0 grid place-items-center rounded-full size-8">
                        <CalendarDays class="size-4"/>
                      </div>
                      <div class="w-1 h-4 bg-muted border-x group-last:opacity-0"></div>
                    </div>
                    <div class="flex flex-col">
                      <span class="font-semibold text-sm ibm-plex-serif">{{ deadline.name }}</span>
                      <span class="text-sm text-muted-foreground">{{ deadline.date }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div class="flex flex-row w-full p-2 border-t gap-3 justify-end">
            <Button size="sm" variant="outline" @click="currentStep--">Back</Button>
            <Button v-if="steps[currentStep-1]?.id === 'field_values'" type="submit" form="fieldValues" size="sm">Next</Button>
            <Button @click="completeApplicationCreation" v-else-if="steps[currentStep-1]?.id === 'preview'" size="sm" :disabled="!!previewError || loading">
              <span v-if="!loading">Finish</span>
              <Loader v-else class="animate-spin" />
            </Button>
            <Button v-else @click="currentStep++" :disabled="(currentStep >= steps.length)" size="sm">Next</Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import {CalendarDays, Check, Circle, Dot, Loader} from 'lucide-vue-next';
import TemplateSelector from "~/components/shared/Matters/CreateMatter/TemplateSelector.vue";
import {DeadlineEngine} from "~/lib/deadline-engine/index.ts";
import {getTemplate} from "~/services/templates/index.ts";
import * as z from 'zod';
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
import { ref, computed, watch } from 'vue';
import {applyApplication} from "~/services/matters/index.ts";

const props = defineProps(['triggerDate', 'matter', 'deadline']);
const selectedTemplate = ref(null);
const matterTemplate = await getTemplate(props.matter.template);

const fieldValues = ref({});
const currentStep = ref(1);
const previewOutput = ref(null);
const previewError = ref(null);

const loading = ref(false);
const open = ref(false);

const steps = computed(() => {
  const baseSteps = [
    { step: 1, id: 'application_type', title: 'Choose Application Type' }
  ];

  if (selectedTemplate.value?.template?.data?.fields?.length > 0) {
    baseSteps.push({ step: 2, id: 'field_values', title: 'Field Values' });
    baseSteps.push({ step: 3, id: 'preview', title: 'Preview' });
  } else {
    baseSteps.push({ step: 2, id: 'preview', title: 'Preview' });
  }

  return baseSteps;
});

// Zod Schema Logic
const formSchema = computed(() => {
  const fields = selectedTemplate?.value?.template?.data?.fields || [];
  const fieldShape = {};
  for (const f of fields) {
    switch (f.type) {
      case "text":
        fieldShape[f.id] = f.required ? z.string().min(1, `${f.label} is required`) : z.string().optional();
        break;
      case "select":
        fieldShape[f.id] = f.required ? z.enum(f.options.map((o) => o.value)) : z.enum(f.options.map((o) => o.value)).optional();
        break;
      case "boolean":
        fieldShape[f.id] = f.required ? z.boolean() : z.boolean().optional();
        break;
      case "date":
        fieldShape[f.id] = f.required ? z.string().refine((v) => v, {message: "Required"}) : z.string().optional();
        break;
    }
  }
  return z.object(fieldShape);
});

const { handleSubmit, setFieldValue, values: formValues, resetForm } = useForm({
  validationSchema: computed(() => toTypedSchema(formSchema.value))
});

/**
 * AUTOMATIC GENERATION LOGIC
 */
const runPreviewGeneration = () => {
  previewError.value = null;
  previewOutput.value = null;

  if (!selectedTemplate.value) return;

  try {
    const output = DeadlineEngine.applyAction(matterTemplate?.template, props.matter.state, {
      action: "SPAWN",
      meta: {
        targetId: props.deadline.t_id,
        template: selectedTemplate.value.template,
        fieldValues: fieldValues.value
      }
    });
    previewOutput.value = output;
  } catch (err) {
    console.error("Preview Generation Error:", err);
    previewError.value = err.message || "An unexpected error occurred while calculating deadlines.";
  }
};

// Watch for step changes to trigger generation
watch(currentStep, (newStep) => {
  const activeStep = steps.value[newStep - 1];
  if (activeStep?.id === 'preview') {
    runPreviewGeneration();
  }
});

const saveValues = handleSubmit((values) => {
  fieldValues.value = values;
  currentStep.value++;
});

watch(selectedTemplate, () => {
  resetForm();
  previewOutput.value = null;
  previewError.value = null;
});

const completeApplicationCreation = async () => {
  try {
  loading.value = true;

  console.log(selectedTemplate?.value?.template);

  const result = await applyApplication(props.deadline, selectedTemplate?.value?.template, fieldValues.value);

  loading.value = false;

  open.value = false;
  currentStep.value = 1;
  fieldValues.value = {};
  selectedTemplate.value = null;
  } catch(e) {
    console.error(e);
  }
}
</script>