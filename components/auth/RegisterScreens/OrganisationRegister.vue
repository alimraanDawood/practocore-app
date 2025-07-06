<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { h } from 'vue'
import * as z from 'zod'
import { AutoForm } from '@/components/ui/auto-form'
import { Button } from '@/components/ui/button'

const emits = defineEmits(['complete']);
const schema = z.object({
  firmName: z.string().describe("Firm Name"),
  legalBusinessName: z.string().describe("Legal Business Name").optional(),
  firmEmailDomain: z.string().describe("Firm Email Domain").optional(),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
})

function onSubmit(values: Record<string, any>) {
  emits('complete', values);
}
</script>

<template>
  <div class="flex flex-col gap-5 h-full justify-center">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Register Your Law Firm </span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>

    <div class="flex flex-col w-full gap-3">
      <AutoForm
          class="w-full space-y-8"
          :schema="schema"
          :form="form"
          :field-config="{
            firmName: {
              inputProps: {
                placeholder: 'Smith & Associates Law Firm'
              },
              description: 'Your firm\'s official business name'
            },
            legalBusinessName: {
              inputProps: {
                placeholder: 'Smith & Associates LLC'
              },
              description: 'If different from firm name (for billing purposes)'
            },
            firmEmailDomain: {
              inputProps: {
                placeholder: 'smithlaw.com'
              },
              description: 'Your firm\'s email domain (helps verify team members)'
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