<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { h } from 'vue'
import * as z from 'zod'
import { AutoForm } from '@/components/ui/auto-form'
import { Button } from '@/components/ui/button'
import FirmPracticeAreasInput from "~/components/auth/RegisterScreens/FirmPracticeAreasInput.vue";

const props =  defineProps(['firmDetailsData'])
const emits = defineEmits(['complete'])
const firmSizes = {
  'Solo Practitioner': 'SOLO_PRACTITIONER',
  '2-10 attorneys': '2-10',
  '11-50 attorneys': '11-50',
  '51-100 attorneys': '51-100',
  '100+ attorneys': '100+',
}

const firmSizesRev = {
  'SOLO_PRACTITIONER': 'Solo Practitioner',
  '2-10': '2-10 attorneys',
  '11-50': '11-50 attorneys',
  '51-100': '51-100 attorneys',
  '100+': '100+ attorneys',
}

const schema = z.object({
  firmSize: z.enum(['Solo Practitioner', '2-10 attorneys', '11-50 attorneys', '51-100 attorneys', '100+ attorneys']),
  primaryPracticeAreas: z.array(z.string()),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    primaryPracticeAreas: props.firmDetailsData?.primaryPracticeAreas,
    firmSize: firmSizesRev[props.firmDetailsData?.firmSize]
  }
})

function onSubmit(values: Record<string, any>) {
  values.firmSize = firmSizes[values.firmSize];
  emits('complete', values)
}
</script>

<template>
  <div class="flex flex-col gap-5 h-full overflow-y-scroll py-3 px-1">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Firm Details</span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>

    <div class="flex flex-col w-full gap-3">
      <AutoForm
          :initial-values="{
            primaryPracticeAreas: firmDetailsData?.primaryPracticeAreas,
            firmSize: firmSizesRev[firmDetailsData?.firmSize]
          }"
          class="w-full space-y-8"
          :schema="schema"
          :form="form"
          :field-config="{
            firmSize: {
              inputProps: {
                placeholder: 'Select a number'
              },
              description: 'How many practitioners do you have?'
            },

            primaryPracticeAreas: {
              label: 'Primary Practice Areas',
              component: FirmPracticeAreasInput,
              description: 'Select the primary areas of expertise for your firm'
            },
          }"
          @submit="onSubmit"
      >
        <Button class="w-full" type="submit">
          Continue
        </Button>
      </AutoForm>
    </div>
  </div>
</template>

<style scoped>
</style>