<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import PasswordInput from './PasswordInput.vue'
import { signInWithEmail, signUpWithGoogle } from "~/services/auth";
import { toast } from 'vue-sonner';
const emits = defineEmits(['success']);

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const isGoogleLoading = ref(false);

async function onSubmit(event: Event) {
  event.preventDefault()
  if (!email.value || !password.value)
    return

  isLoading.value = true

  try {
    const result = await signInWithEmail(email.value, password.value);

    if (result) {
      emits('success', result);
    }

  } catch (e) {
    console.error(e);
    toast.error("We were unable to sign you in!");
  }

  isLoading.value = false;
}

async function continueWithGoogle() {
  isGoogleLoading.value = true;
  try {
    const result = await signUpWithGoogle();

    if (result) {
      emits('success', result);
    }
  } catch (e) {
    console.error(e);

    toast.error('We were unable to sign you in at this time!');
  }
  isGoogleLoading.value = false;
}
</script>

<template>
  <div class="flex flex-col w-full gap-3">
    <div class="flex flex-col w-full gap-4">
      <Button :disabled="isGoogleLoading" @click="continueWithGoogle" variant="secondary" class="w-full gap-2">
        <svg v-if="!isGoogleLoading" class="size-4" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>
        <Loader2 v-else class="animate-spin" />
        Login with Google
      </Button>
    </div>
    <Separator label="Or continue with" />
    <form @submit="onSubmit" class="grid gap-6">
      <div @submit="onSubmit" class="grid gap-2">
        <Label for="email">
          Email
        </Label>
        <Input id="email" v-model="email" type="email" placeholder="name@example.com" :disabled="isLoading"
          auto-capitalize="none" auto-complete="email" auto-correct="off" />
      </div>
      <div class="grid gap-2">
        <div class="flex items-center">
          <Label for="password">
            Password
          </Label>
          <NuxtLink to="/auth/forgot-password" class="ml-auto inline-block text-sm underline">
            Forgot your password?
          </NuxtLink>
        </div>
        <PasswordInput id="password" v-model="password" />
      </div>
      <Button type="submit" class="w-full bg-tertiary hover:bg-tertiary/90" :disabled="isLoading">
        <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
        Login
      </Button>
    </form>
  </div>
  <div class="mt-4 text-center text-sm text-muted-foreground">
    Don't have an account?
    <NuxtLink to="/auth/register" class="underline">
      Sign up
    </NuxtLink>
  </div>
</template>

<style scoped></style>
