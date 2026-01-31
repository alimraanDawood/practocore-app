<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { signUpWithGoogle } from "~/services/auth"
import { Loader2 } from 'lucide-vue-next';

const props = defineProps(['adminData', 'inviteRef']);
const emits = defineEmits(['complete', 'google'])

const schema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  emailAddress: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).superRefine(({ confirmPassword, password }, ctx) => {
  if (confirmPassword !== password) {
    ctx.addIssue({
      code: "custom",
      message: "The passwords did not match",
      path: ['confirmPassword']
    })
  }
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    fullName: props.adminData?.fullName || '',
    emailAddress: props.adminData?.emailAddress || '',
    password: props.adminData?.password || '',
    confirmPassword: props.adminData?.confirmPassword || '',
  }
})

const onSubmit = form.handleSubmit((values) => {
  emits('complete', { ...values, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
});

const isGoogleLoading = ref(false);

async function continueWithGoogle() {
  isGoogleLoading.value = true;
  try {
    const result = await signUpWithGoogle()
    console.log(result)
    emits('google', result)
  } catch(e) {
    console.error(e)
  }
  isGoogleLoading.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-5 h-full w-full justify-center overflow-y-scroll">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Create Your Login</span>
      <span v-if="inviteRef" class="text-sm">Your account will be added to <b>{{ inviteRef.invite.organisation.name }}</b></span>
      <span v-else class="text-sm">You'll use these credentials to access PractoCore.</span>
    </div>

    <div class="flex flex-col w-full gap-3">
      <form @submit="onSubmit" class="w-full space-y-5">
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
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input 
                type="email" 
                placeholder="johnsmith@smithlaw.com" 
                v-bind="componentField" 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input 
                type="password" 
                placeholder="Enter your password" 
                v-bind="componentField" 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="confirmPassword">
          <FormItem>
            <FormLabel>Confirm Password</FormLabel>
            <FormControl>
              <Input 
                type="password" 
                placeholder="Re-enter your password" 
                v-bind="componentField" 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button class="w-full" type="submit">
          Register
        </Button>
      </form>

      <div class="flex flex-row gap-2 items-center">
        <div class="h-[1px] bg-muted-foreground/50 w-full"></div>
        <span class="text-muted-foreground text-xs whitespace-nowrap">OR CONTINUE WITH</span>
        <div class="h-[1px] bg-muted-foreground/50 w-full"></div>
      </div>

      <div class="grid grid-cols-1 w-full gap-2">
        <Button :disabled="isGoogleLoading" @click="continueWithGoogle" class="w-full" variant="secondary">
          <svg v-if="!isGoogleLoading" class="size-4" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>
          <Loader2 v-else class="animate-spin" />
          Google
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>