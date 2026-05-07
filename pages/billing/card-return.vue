<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-6">
    <div class="flex flex-col items-center gap-6 max-w-sm w-full text-center">

      <!-- Processing -->
      <template v-if="status === 'processing'">
        <div class="relative">
          <div class="size-20 rounded-full border-4 border-muted animate-pulse" />
          <Loader2 class="size-10 text-primary animate-spin absolute top-5 left-5" />
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-semibold ibm-plex-serif">Verifying your payment...</h2>
          <p class="text-sm text-muted-foreground">Please wait while we confirm your transaction.</p>
        </div>
      </template>

      <!-- Success -->
      <template v-else-if="status === 'success'">
        <div class="size-20 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
          <CheckCircle2 class="size-10 text-green-600" />
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-semibold ibm-plex-serif">Payment Confirmed!</h2>
          <p class="text-sm text-muted-foreground">Activating your subscription...</p>
        </div>
      </template>

      <!-- Timeout / Failure -->
      <template v-else-if="status === 'timeout'">
        <div class="size-20 rounded-full bg-amber-100 dark:bg-amber-900/30 grid place-items-center">
          <Clock class="size-10 text-amber-600" />
        </div>
        <div class="flex flex-col gap-2">
          <h2 class="text-xl font-semibold ibm-plex-serif">Payment Being Verified</h2>
          <p class="text-sm text-muted-foreground">
            Your payment is being verified. Check your billing page for the latest status.
          </p>
        </div>
        <Button @click="goToBilling" class="w-full">Go to Billing Settings</Button>
      </template>

    </div>
  </div>
</template>

<script setup>
import { Loader2, CheckCircle2, Clock } from 'lucide-vue-next';
import { getSubscriptionStatus } from '~/services/subscriptions/index.ts';

definePageMeta({ auth: false });

const status = ref('processing'); // 'processing' | 'success' | 'timeout'

let pollInterval = null;
let pollTimeout = null;

const goToBilling = () => navigateTo('/main/settings/billing');

const stopPolling = () => {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
};

onMounted(() => {
  const subscriptionId = localStorage.getItem('pendingCardSubscriptionId');

  if (!subscriptionId) {
    status.value = 'timeout';
    return;
  }

  pollInterval = setInterval(async () => {
    try {
      const result = await getSubscriptionStatus(subscriptionId);
      if (result.paymentStatus === 'complete' && result.active) {
        stopPolling();
        localStorage.removeItem('pendingCardSubscriptionId');
        status.value = 'success';
        setTimeout(() => goToBilling(), 2000);
      }
    } catch (err) {
      console.warn('Card return poll error:', err);
    }
  }, 3000);

  pollTimeout = setTimeout(() => {
    if (status.value === 'processing') {
      stopPolling();
      localStorage.removeItem('pendingCardSubscriptionId');
      status.value = 'timeout';
    }
  }, 60000);
});

onBeforeUnmount(() => stopPolling());
</script>
