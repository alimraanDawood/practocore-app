<script setup lang="ts">
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import PasswordInput from '~/components/auth/PasswordInput.vue';
import { confirmPasswordReset } from '~/services/auth';

definePageMeta({
  layout: 'blank',
});

// PocketBase's reset email links here with ?token=<jwt>. The token both identifies
// the account and authorises the change, so no email field is needed on this page.
const token = computed(() => String(useRoute().query.token ?? ''));

const password = ref('');
const passwordConfirm = ref('');
const isLoading = ref(false);
const done = ref(false);

const mismatch = computed(() =>
  passwordConfirm.value.length > 0 && password.value !== passwordConfirm.value,
);

async function onSubmit(event: Event) {
  event.preventDefault();
  if (isLoading.value) return;

  if (!token.value) {
    toast.error('This reset link is invalid or has expired. Please request a new one.');
    return;
  }
  if (password.value.length < 8) {
    toast.error('Password must be at least 8 characters.');
    return;
  }
  if (password.value !== passwordConfirm.value) {
    toast.error('Passwords do not match.');
    return;
  }

  isLoading.value = true;
  try {
    await confirmPasswordReset(token.value, password.value, passwordConfirm.value);
    done.value = true;
  } catch (e) {
    console.error(e);
    toast.error('We could not reset your password. The link may have expired — request a new one.');
  }
  isLoading.value = false;
}
</script>

<template>
  <div class="flex flex-col w-screen h-dvh divide-x">
    <div class="flex flex-col w-full h-full col-span-1">
      <div class="flex flex-row p-3 border-b justify-between">
        <div></div>
        <SharedDarkModeSwitch />
      </div>

      <div class="flex flex-col w-full h-full gap-5 items-center justify-center">
        <div class="flex flex-col w-[95vw] items-center justify-center max-w-xl p-3 border-x h-full">
          <div class="flex flex-col w-full max-w-sm gap-5">
            <div class="grid gap-2 text-center">
              <div class="flex flex-row w-full items-center justify-center">
                <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-12" />
              </div>
              <h1 class="text-2xl font-semibold tracking-tight ibm-plex-serif">
                {{ done ? 'Password updated' : 'Set a new password' }}
              </h1>
              <p class="text-balance text-sm text-muted-foreground">
                <template v-if="done">
                  Your password has been changed. You can now sign in with your new password.
                </template>
                <template v-else>
                  Choose a strong password you don't use anywhere else.
                </template>
              </p>
            </div>

            <div v-if="done" class="flex flex-col items-center gap-5">
              <div class="flex size-12 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
                <CheckCircle2 class="size-6" />
              </div>
              <Button as-child class="w-full bg-tertiary hover:bg-tertiary/90">
                <NuxtLink to="/auth/login">Go to login</NuxtLink>
              </Button>
            </div>

            <template v-else>
              <div v-if="!token" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-center text-sm text-destructive">
                This reset link is missing or invalid. Please
                <NuxtLink to="/auth/forgot-password" class="underline underline-offset-4">request a new one</NuxtLink>.
              </div>

              <form v-else @submit="onSubmit" class="grid gap-6">
                <div class="grid gap-2">
                  <Label for="password">New password</Label>
                  <PasswordInput id="password" v-model="password" autocomplete="new-password"
                                 placeholder="At least 8 characters" />
                </div>
                <div class="grid gap-2">
                  <Label for="passwordConfirm">Confirm new password</Label>
                  <PasswordInput id="passwordConfirm" v-model="passwordConfirm" autocomplete="new-password"
                                 placeholder="Re-enter your password" />
                  <p v-if="mismatch" class="text-sm text-destructive">Passwords do not match.</p>
                </div>
                <Button type="submit" class="w-full bg-tertiary hover:bg-tertiary/90"
                        :disabled="isLoading || mismatch">
                  <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
                  Reset password
                </Button>
              </form>
            </template>

            <div class="text-center text-sm text-muted-foreground">
              <NuxtLink to="/auth/login" class="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground">
                <ArrowLeft class="size-3.5" /> Back to login
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-row p-3 border-t"></div>
    </div>
  </div>
</template>

<style scoped></style>
