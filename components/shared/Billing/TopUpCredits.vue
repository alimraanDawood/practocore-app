<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger">
        <Button :size="size" :variant="variant">{{ label }}</Button>
      </slot>
    </DialogTrigger>
    <DialogContent>
      <!-- Step 1: choose a pack -->
      <template v-if="!purchase">
        <DialogHeader>
          <DialogTitle>Buy AI credits</DialogTitle>
          <DialogDescription>
            Choose a pack<template v-if="creditRate > 0"> — credits are
            UGX {{ creditRate.toLocaleString() }} each</template>. We'll raise an invoice and
            open a payment page; the credits land in your
            {{ isSolo ? '' : 'team ' }}pool once payment is confirmed.
          </DialogDescription>
        </DialogHeader>
        <div class="grid grid-cols-3 gap-2 py-2">
          <button
            v-for="pack in packs"
            :key="pack.credits"
            type="button"
            class="flex flex-col items-center gap-0.5 rounded-lg border p-3 transition hover:border-primary"
            :class="selectedPack === pack.credits ? 'border-primary ring-1 ring-primary' : ''"
            @click="selectedPack = pack.credits"
          >
            <span class="font-semibold">{{ fmt(pack.credits) }}</span>
            <span class="text-xs text-muted-foreground">credits</span>
            <span v-if="pack.priceLabel" class="text-xs mt-1">{{ pack.priceLabel }}</span>
          </button>
        </div>
        <p v-if="topUpError" class="text-sm text-destructive">{{ topUpError }}</p>
        <DialogFooter>
          <Button variant="ghost" :disabled="working" @click="close">Cancel</Button>
          <Button :disabled="working" @click="startPurchase">
            {{ working ? 'Preparing…' : 'Continue to payment' }}
          </Button>
        </DialogFooter>
      </template>

      <!-- Step 2: the payment is happening in a browser we can't see into -->
      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ settled ? 'Credits added' : 'Waiting for payment' }}</DialogTitle>
          <DialogDescription>
            <template v-if="settled">
              {{ fmt(purchase.credits) }} credits have been added to your pool.
            </template>
            <template v-else>
              Invoice {{ purchase.invoice }} for {{ purchase.total }} is open in your browser.
              Complete the payment there — approving it on your phone can take a moment.
            </template>
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-row items-center gap-3 py-2 text-sm">
          <Icon
            :name="settled ? 'lucide:check-circle-2' : 'lucide:loader-circle'"
            class="size-5 shrink-0"
            :class="settled ? 'text-emerald-600' : 'animate-spin text-muted-foreground'"
          />
          <span class="text-muted-foreground">
            <template v-if="settled">Payment confirmed.</template>
            <template v-else-if="timedOut">
              We haven't seen the payment yet. If you've paid, the credits will appear on
              their own — you can close this.
            </template>
            <template v-else>Watching for confirmation…</template>
          </span>
        </div>

        <p v-if="topUpError" class="text-sm text-destructive">{{ topUpError }}</p>

        <DialogFooter>
          <Button v-if="!settled" variant="ghost" @click="reopenCheckout">
            Reopen payment page
          </Button>
          <Button @click="close">{{ settled ? 'Done' : 'Close' }}</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
// The buy-credits flow, in one place.
//
// It was written inline in Billing/AiCredits.vue, which was fine while Billing
// was the only screen that offered it. It now has to be reachable from the
// spending screen too, and a second copy of a PAYMENT flow is not a thing to
// keep in step by hand — this is the flow, and both screens mount it.
//
// The component owns nothing but the purchase: the caller decides who is
// allowed to see it and what the surrounding card says. On settlement it
// refreshes the shared usage state (so the gauge, the gate and the pool bar all
// move together) and emits `settled` for anything the caller needs to reload.

import { ref, computed, onBeforeUnmount } from 'vue';
import {
  purchaseCredits,
  openCheckout,
  waitForPayment,
  checkoutTokenFromURL,
  type CreditPurchase,
} from '~/services/billing';
import { useAiUsage } from '~/composables/useAiUsage';

const props = withDefaults(defineProps<{
  /** Team wording vs personal wording in the dialog copy. */
  isSolo?: boolean;
  label?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}>(), {
  isSolo: false,
  label: 'Top up',
  size: 'sm',
  variant: 'outline',
});

const emit = defineEmits<{ (e: 'settled'): void }>();

const { usage, refresh } = useAiUsage();

const fmt = (n: number) => Math.round(n).toLocaleString();

// Pack sizes are ours; the PRICE is the server's. The rate used to be written
// out as three fixed labels, which quoted a figure the invoice did not have to
// agree with — the backend prices from AI_OVERAGE_UGX_PER_CREDIT, and nothing
// kept the two in step. Only the sizes are declared here.
const packSizes = [250, 500, 1000];

const creditRate = computed(() => usage.value?.overage_ugx_per_credit ?? 0);

const packs = computed(() =>
  packSizes.map((credits) => ({
    credits,
    // No rate yet (usage still loading) means no price claim at all. Showing a
    // guess is what this exists to stop.
    priceLabel: creditRate.value > 0
      ? `${(credits * creditRate.value).toLocaleString()} UGX`
      : '',
  })),
);

const open = ref(false);
const selectedPack = ref(packSizes[1]);
const working = ref(false);
const topUpError = ref('');

// A raised-but-unpaid purchase. Its presence is what switches the dialog from
// "choose a pack" to "waiting for payment": credits are granted by the
// settlement path on the server, so from here a purchase is a thing we watch,
// not a thing we complete.
const purchase = ref<CreditPurchase | null>(null);
const settled = ref(false);
const timedOut = ref(false);
let pollAbort: AbortController | null = null;

async function startPurchase() {
  working.value = true;
  topUpError.value = '';
  try {
    const p = await purchaseCredits(selectedPack.value);
    purchase.value = p;
    await openCheckout(p.checkout_url);
    watchForSettlement(p);
  } catch (e: any) {
    topUpError.value = e?.message ?? 'Could not start the purchase. Try again.';
  } finally {
    working.value = false;
  }
}

async function watchForSettlement(p: CreditPurchase) {
  const token = checkoutTokenFromURL(p.checkout_url);
  if (!token) return;

  pollAbort?.abort();
  pollAbort = new AbortController();

  const paid = await waitForPayment(token, { signal: pollAbort.signal });
  if (pollAbort.signal.aborted) return;

  if (paid) {
    settled.value = true;
    // The balance moved on the server; pull it so the header gauge and the chat
    // credit gate see the new pool too.
    await refresh();
    emit('settled');
  } else {
    timedOut.value = true;
  }
}

async function reopenCheckout() {
  if (purchase.value) await openCheckout(purchase.value.checkout_url);
}

function close() {
  pollAbort?.abort();
  pollAbort = null;
  open.value = false;
  // Reset only after the dialog's close animation, so the panel does not flip
  // back to the pack picker while it is still on screen.
  setTimeout(() => {
    purchase.value = null;
    settled.value = false;
    timedOut.value = false;
    topUpError.value = '';
  }, 200);
}

onBeforeUnmount(() => pollAbort?.abort());
</script>
