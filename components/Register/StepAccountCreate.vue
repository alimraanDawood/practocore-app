<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <User class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">Create your account</h2>
        <p class="text-muted-foreground text-sm">
          Get started managing your litigation deadlines. It only takes a moment.
        </p>
      </div>

      <!-- Google sign-in -->
      <div class="flex flex-col gap-3 w-full max-w-sm">
        <Button
          type="button"
          variant="outline"
          class="w-full"
          :disabled="isGoogleLoading"
          @click="onGoogleSignIn"
        >
          <svg
            v-if="!isGoogleLoading"
            class="size-4 mr-2 shrink-0"
            viewBox="-3 0 262 262"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid"
          >
            <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4" />
            <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853" />
            <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05" />
            <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335" />
          </svg>
          <Loader2 v-else class="size-4 mr-2 animate-spin" />
          Continue with Google
        </Button>

        <div class="flex items-center gap-3">
          <div class="h-px bg-border flex-1" />
          <span class="text-xs text-muted-foreground">or continue with email</span>
          <div class="h-px bg-border flex-1" />
        </div>
      </div>

      <!-- Email/password form -->
      <form
        id="account-form"
        class="flex flex-col gap-4 w-full max-w-sm"
        @submit.prevent="handleNext"
      >
        <FormField v-slot="{ componentField }" name="fullName" :validate-on-blur="true">
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <Input
                type="text"
                placeholder="Amina Nakato"
                v-bind="componentField"
                autocomplete="name"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="emailAddress" :validate-on-blur="true">
          <FormItem>
            <FormLabel>Email address</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="amina@nakatolaw.co.ug"
                v-bind="componentField"
                autocomplete="email"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="password" :validate-on-blur="true">
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <AuthPasswordInput
                placeholder="At least 8 characters"
                :component-field="componentField"
                autocomplete="new-password"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="confirmPassword" :validate-on-blur="true">
          <FormItem>
            <FormLabel>Confirm password</FormLabel>
            <FormControl>
              <AuthPasswordInput
                placeholder="Re-enter your password"
                :component-field="componentField"
                autocomplete="new-password"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- Hidden submit so Enter key works -->
        <button type="submit" class="hidden" />
      </form>

      <p class="text-xs text-muted-foreground text-center max-w-sm">
        By continuing, you agree to our
        <a href="#" class="underline hover:text-foreground">Terms of Service</a>
        and
        <a href="#" class="underline hover:text-foreground">Privacy Policy</a>.
        A small trial fee applies — paid via mobile money on the next step.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Loader2 } from 'lucide-vue-next'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { toast } from 'vue-sonner'
import { useRegisterStore } from '~/stores/register'
import { signUpWithGoogle } from '~/services/auth'
import { pb } from '~/lib/pocketbase'

const store = useRegisterStore()

const isGoogleLoading = ref(false)
const isCreatingUser = ref(false)

const accountSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    emailAddress: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
    }
  })

const { values, handleSubmit } = useForm({
  validationSchema: toTypedSchema(accountSchema),
  // Re-hydrate from store so Back-nav doesn't wipe the form
  initialValues: {
    fullName: store.accountFormValues.fullName,
    emailAddress: store.accountFormValues.emailAddress,
    password: store.accountFormValues.password,
    confirmPassword: store.accountFormValues.confirmPassword,
  },
})


const onGoogleSignIn = async () => {
  isGoogleLoading.value = true
  try {
    const result = await signUpWithGoogle()
    store.isGoogleAuth = true
    store.googleUserId = result.record?.id ?? ''
    // Pre-fill firm contact from Google profile if available
    store.firmContact.fullName = result.record?.name ?? ''
    store.firmContact.emailAddress = result.record?.email ?? ''
    await store.advance('account-create')
  } catch {
    toast.error('Google sign-in failed. Please try again.')
  } finally {
    isGoogleLoading.value = false
  }
}

const onValidSubmit = handleSubmit(async (vals) => {
  isCreatingUser.value = true
  try {
    await pb.collection('Users').create({
      name: vals.fullName,
      email: vals.emailAddress,
      password: vals.password,
      passwordConfirm: vals.confirmPassword,
      emailVisibility: true,
    })

    await pb.collection('Users').authWithPassword(vals.emailAddress, vals.password)
    store.createdUserId = pb.authStore.record?.id || ''

    store.firmContact.fullName = vals.fullName ?? ''
    store.firmContact.emailAddress = vals.emailAddress ?? ''

    await store.advance('account-create')
  } catch (e: any) {
    const msg =
      e?.response?.data?.email?.message ??
      e?.message ??
      'Failed to create account. That email may already be in use.'
    toast.error(msg)
  } finally {
    isCreatingUser.value = false
  }
})

const handleNext = async () => {
  store.accountFormValues = {
    fullName: values.fullName ?? '',
    emailAddress: values.emailAddress ?? '',
    password: values.password ?? '',
    confirmPassword: values.confirmPassword ?? '',
  }
  await onValidSubmit()
}

onMounted(() => { store.stepNextAction = handleNext })
onUnmounted(() => { store.stepNextAction = null })
</script>
