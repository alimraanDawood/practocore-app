<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { h } from 'vue'
import * as z from 'zod'
import { AutoForm } from '@/components/ui/auto-form'
import { Button } from '@/components/ui/button'

const emits = defineEmits(['complete'])

const schema = z.object({
  fullName: z.string().describe("Full Name"),
  emailAddress: z.string().describe("Email Address"),
  phoneNumber: z.string().describe("Phone Number").optional(),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
})

function onSubmit(values: Record<string, any>) {
  emits('complete', values)
}
</script>

<template>
  <div class="flex flex-col gap-5 h-full justify-center">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Primary Contact Information</span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>

    <div class="flex flex-col w-full gap-3">
      <AutoForm
          class="w-full space-y-8"
          :schema="schema"
          :form="form"
          :field-config="{
            fullName: {
              inputProps: {
                placeholder: 'John Smith'
              },
            },
            emailAddress: {
              inputProps: {
                type: 'email',
                placeholder: 'johnsmith@smithlaw.com'
              },
              description: 'This will be the firm\'s primary contact'
            },
            phoneNumber: {
              inputProps: {
                placeholder: '+1 (555) 123-4567'
              },
              description: 'For account verification and important notifications'
            }
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