<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FirmPracticeAreasInput from "~/components/auth/RegisterScreens/FirmPracticeAreasInput.vue"

const props = defineProps(['firmDetailsData'])
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

const firmSizeOptions = [
  'Solo Practitioner',
  '2-10 attorneys',
  '11-50 attorneys',
  '51-100 attorneys',
  '100+ attorneys',
]

const schema = z.object({
  firmSize: z.enum(['Solo Practitioner', '2-10 attorneys', '11-50 attorneys', '51-100 attorneys', '100+ attorneys'], {
    required_error: 'Please select a firm size',
  }),
  primaryPracticeAreas: z.array(z.string()).min(1, 'Please select at least one practice area'),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    primaryPracticeAreas: props.firmDetailsData?.primaryPracticeAreas || [],
    firmSize: firmSizesRev[props.firmDetailsData?.firmSize] || undefined,
  }
})

const onSubmit = form.handleSubmit((values) => {
  const submissionData = {
    ...values,
    firmSize: firmSizes[values.firmSize],
  }
  emits('complete', submissionData)
})
</script>

<template>
  <div class="flex flex-col gap-5 h-full overflow-y-scroll py-3 px-1">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Firm Details</span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>
    
    <form @submit="onSubmit" class="flex flex-col w-full gap-6">
      <FormField v-slot="{ componentField }" name="firmSize">
        <FormItem>
          <FormLabel>Firm Size</FormLabel>
          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a number" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem
                v-for="size in firmSizeOptions"
                :key="size"
                :value="size"
              >
                {{ size }}
              </SelectItem>
            </SelectContent>
          </Select>
          <FormDescription>
            How many practitioners do you have?
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="primaryPracticeAreas">
        <FormItem>
          <FormLabel>Primary Practice Areas</FormLabel>
          <FormControl>
            <FirmPracticeAreasInput v-bind="componentField" />
          </FormControl>
          <FormDescription>
            Select the primary areas of expertise for your firm
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <Button class="w-full" type="submit">
        Continue
      </Button>
    </form>
  </div>
</template>

<style scoped>
</style>