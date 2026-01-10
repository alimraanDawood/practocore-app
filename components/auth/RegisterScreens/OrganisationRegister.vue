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
import { Input } from '@/components/ui/input'

const props = defineProps(['organisationData'])
const emits = defineEmits(['complete'])

const schema = z.object({
  firmName: z.string().min(1, 'Firm name is required'),
  firmEmailDomain: z.string().optional(),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    firmName: props.organisationData?.firmName || '',
    firmEmailDomain: props.organisationData?.firmEmailDomain || '',
  }
})

const onSubmit = form.handleSubmit((values) => {
  emits('complete', values)
})
</script>

<template>
  <div class="flex flex-col gap-5 h-full justify-center">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Register Your Law Firm</span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>
    
    <form @submit="onSubmit" class="flex flex-col w-full gap-6">
      <FormField v-slot="{ componentField }" name="firmName">
        <FormItem>
          <FormLabel>Firm Name</FormLabel>
          <FormControl>
            <Input 
              type="text" 
              placeholder="Smith & Associates Law Firm"
              v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            Your firm's official business name
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="firmEmailDomain">
        <FormItem>
          <FormLabel>Firm Email Domain</FormLabel>
          <FormControl>
            <Input 
              type="text" 
              placeholder="smithlaw.com"
              v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            Your firm's email domain (helps verify team members)
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