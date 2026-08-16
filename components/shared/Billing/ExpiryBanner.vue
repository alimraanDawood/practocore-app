<template>
  <div v-if="shouldShow" :class="bannerClasses" class="flex flex-row items-center gap-2 p-1.5 px-3 border-b">
    <component :is="bannerIcon" class="size-4 shrink-0" />
    <span class="text-sm font-semibold flex-1">
      {{ message }}
      <SharedBillingSubscribe v-if="offersRenewal">
        <button class="font-bold underline ml-1">{{ actionLabel }}</button>
      </SharedBillingSubscribe>
    </span>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, Lock, FileLock2 } from 'lucide-vue-next';
import { useAccess } from '~/composables/useAccess';

// The banner renders the server's access decision rather than recomputing
// expiry from a term end date. Deriving it here was how the old banner and the
// old server disagreed: a contract firm on an access grant saw "expired" while
// every request sailed through, and a suspended workspace saw nothing at all.
const { access, refresh, isInGrace, isReadOnly, isLocked } = useAccess();

onMounted(refresh);

const subject = computed(() => (access.value?.is_trial ? 'free trial' : 'subscription'));
const daysRemaining = computed(() => access.value?.days_remaining ?? 0);

/**
 * A holder inside the term with a near end date. The server calls this level
 * "full" — nothing is restricted yet — so the warning window is a UI decision,
 * and the only one this component still makes.
 */
const expiringSoon = computed(() => {
  if (!access.value) return false;
  if (access.value.level !== 'full') return false;
  if (access.value.reason !== 'active' && access.value.reason !== 'trial_active') return false;
  // Already renewed — the cover continues, so there is nothing to warn about.
  if (access.value.next_term_start) return false;
  return daysRemaining.value >= 0 && daysRemaining.value <= 7;
});

const suspended = computed(() => access.value?.reason === 'suspended');

// Suspension is a support matter, not a renewal one — offering "Renew now"
// there sends the user to a payment flow that will not restore their access.
const offersRenewal = computed(() => !suspended.value);

const actionLabel = computed(() =>
  access.value?.reason === 'no_subscription' ? 'Choose a plan' : 'Renew now',
);

const message = computed(() => {
  if (!access.value) return '';

  if (suspended.value) {
    return 'This workspace is suspended. Contact support to restore access.';
  }
  if (isLocked.value) {
    if (access.value.reason === 'no_subscription') {
      return 'This workspace has no active subscription.';
    }
    if (access.value.reason === 'awaiting_payment') {
      return `Your ${subject.value} is awaiting payment.`;
    }
    return `Your ${subject.value} has expired and this workspace is locked.`;
  }
  if (isReadOnly.value) {
    // Say what still works. This is a deadline product: a firm that has missed a
    // payment must not think it has also lost sight of its filing dates.
    return `Your ${subject.value} has expired. Your workspace is read-only — you can still view and export everything.`;
  }
  if (isInGrace.value) {
    return `Your ${subject.value} has ended. Everything still works for now.`;
  }
  if (expiringSoon.value) {
    const unit = daysRemaining.value === 1 ? 'day' : 'days';
    return `Your ${subject.value} expires in ${daysRemaining.value} ${unit}.`;
  }
  return '';
});

const shouldShow = computed(() => !!message.value);

const bannerIcon = computed(() => {
  if (isLocked.value || suspended.value) return Lock;
  if (isReadOnly.value) return FileLock2;
  return AlertTriangle;
});

const bannerClasses = computed(() => {
  if (isLocked.value || suspended.value) return 'bg-destructive text-destructive-foreground';
  if (isReadOnly.value) return 'bg-primary text-primary-foreground';
  return 'bg-amber-500 text-white dark:bg-amber-600';
});
</script>
