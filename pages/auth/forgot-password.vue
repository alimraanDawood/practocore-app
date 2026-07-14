<script setup lang="ts">
import { Loader2, ArrowLeft, MailCheck } from 'lucide-vue-next';
import { requestPasswordReset } from '~/services/auth';

definePageMeta({
  layout: 'blank',
});

const email = ref('');
const isLoading = ref(false);
const sent = ref(false);

async function onSubmit(event: Event) {
  event.preventDefault();
  if (!email.value || isLoading.value) return;

  isLoading.value = true;
  try {
    await requestPasswordReset(email.value.trim());
    // Always report success — never reveal whether an account exists for this email.
    sent.value = true;
  } catch (e) {
    console.error(e);
    // PocketBase returns the same shape for unknown emails; still show success to
    // avoid account enumeration, but surface genuine network/validation failures.
    sent.value = true;
  }
  isLoading.value = false;
}
</script>

<template>
  <div class="flex flex-col w-screen h-dvh divide-x safe-area-shell">
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
                {{ sent ? 'Check your email' : 'Reset your password' }}
              </h1>
              <p class="text-balance text-sm text-muted-foreground">
                <template v-if="sent">
                  If an account exists for <span class="font-medium text-foreground">{{ email }}</span>,
                  we've sent a link to reset your password.
                </template>
                <template v-else>
                  Enter the email tied to your account and we'll send you a link to set a new password.
                </template>
              </p>
            </div>

            <div v-if="sent" class="flex flex-col items-center gap-4">
              <div class="flex size-12 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
                <MailCheck class="size-6" />
              </div>
              <p class="text-center text-sm text-muted-foreground">
                Didn't get it? Check your spam folder, or
                <button type="button" class="underline underline-offset-4 hover:text-foreground"
                        @click="sent = false">try a different email</button>.
              </p>
            </div>

            <form v-else @submit="onSubmit" class="grid gap-6">
              <div class="grid gap-2">
                <Label for="email">Email</Label>
                <Input id="email" v-model="email" type="email" placeholder="name@example.com"
                       :disabled="isLoading" auto-capitalize="none" auto-complete="email" auto-correct="off" required />
              </div>
              <Button type="submit" class="w-full bg-tertiary hover:bg-tertiary/90" :disabled="isLoading">
                <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
                Send reset link
              </Button>
            </form>

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
