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

const props = defineProps(['primaryContactData'])
const emits = defineEmits(['complete'])

const schema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  emailAddress: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    fullName: props.primaryContactData?.contact?.fullName || '',
    emailAddress: props.primaryContactData?.contact?.emailAddress || '',
    phoneNumber: props.primaryContactData?.contact?.phoneNumber || '',
  }
})

const onSubmit = form.handleSubmit((values) => {
  emits('complete', values)
})
</script>

<template>
  <div class="flex flex-col gap-5 h-full justify-center">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Primary Contact Information</span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>
    
    <form @submit="onSubmit" class="flex flex-col w-full gap-6">
      <FormField v-slot="{ componentField }" name="fullName">
        <FormItem>
          <FormLabel>Full Name</FormLabel>
          <FormControl>
            <Input 
              type="text" 
              placeholder="John Smith"
              v-bind="componentField"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="emailAddress">
        <FormItem>
          <FormLabel>Email Address</FormLabel>
          <FormControl>
            <Input 
              type="email" 
              placeholder="johnsmith@smithlaw.com"
              v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            This will be the firm's primary contact
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="phoneNumber">
        <FormItem>
          <FormLabel>Phone Number</FormLabel>
          <FormControl>
            <Input 
              type="tel" 
              placeholder="+1 (555) 123-4567"
              v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            For account verification and important notifications
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