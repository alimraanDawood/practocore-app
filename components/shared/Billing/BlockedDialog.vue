<template>
  <Dialog :open="!!block" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex flex-row items-center gap-2">
          <Icon :name="titleIcon" class="size-5 shrink-0" />
          {{ title }}
        </DialogTitle>
        <DialogDescription>
          <!-- The server's own wording. It names the actual state — expired,
               unpaid, suspended — which a generic message here could not. -->
          {{ block?.message }}
        </DialogDescription>
      </DialogHeader>

      <p v-if="stillWorks" class="text-sm text-muted-foreground">
        {{ stillWorks }}
      </p>

      <DialogFooter class="gap-2">
        <Button variant="ghost" @click="dismiss">Not now</Button>
        <!-- Sends the user to the billing page rather than opening Subscribe
             inline. Subscribe renders as a vaul-vue Drawer on mobile, and
             nesting that inside this reka-ui Dialog races two body-lock
             managers — the documented way to leave the whole app unclickable. -->
        <Button v-if="offersRenewal" @click="goToBilling">{{ actionLabel }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
// The user-facing half of the billing guard's 402.
//
// Any request can be refused once a workspace stops paying, so this lives in
// the shell rather than at a call site: the refusal arrives from wherever the
// user happened to click. Without it a blocked action fails silently or with a
// generic error, and the user is stopped without being told why — which is the
// worst possible way to ask someone for money.

import { blockedByBilling, clearBillingBlock } from '~/services/billing/gate';
import { useAccess } from '~/composables/useAccess';

const block = blockedByBilling;
const { refresh } = useAccess();

const suspended = computed(() => block.value?.reason === 'suspended');
// Suspension is not fixed by paying, so pointing at a payment flow would waste
// the user's time and their money.
const offersRenewal = computed(() => !suspended.value);

const title = computed(() => {
  if (suspended.value) return 'Workspace suspended';
  if (block.value?.level === 'locked') return 'Subscription needed';
  if (block.value?.required === 'ai') return 'AI is paused';
  return 'Your workspace is read-only';
});

const titleIcon = computed(() => {
  if (suspended.value || block.value?.level === 'locked') return 'lucide:lock';
  if (block.value?.required === 'ai') return 'lucide:sparkles';
  return 'lucide:file-lock-2';
});

const actionLabel = computed(() =>
  block.value?.reason === 'no_subscription' ? 'Choose a plan' : 'Renew now',
);

// Say what survives. In a deadline product the reassurance is the important
// part of the message: nothing has been deleted and nothing is hidden.
const stillWorks = computed(() => {
  if (!block.value || suspended.value || block.value.level === 'locked') return '';
  return 'Your matters, deadlines and documents are all still readable, and you can export anything you need.';
});

function dismiss() {
  clearBillingBlock();
  // Re-read the decision on the way out: the block may already be stale if the
  // user paid in another tab or on their phone.
  refresh();
}

function onOpenChange(open: boolean) {
  if (!open) dismiss();
}

function goToBilling() {
  // Clear first: navigating with the dialog still open leaves its overlay (and
  // the body pointer-events lock) over the page we just landed on.
  clearBillingBlock();
  navigateTo('/main/settings/billing');
}
</script>
