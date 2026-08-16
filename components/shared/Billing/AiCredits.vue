<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <h2 class="font-semibold text-lg">AI Credits</h2>
      <p class="text-sm text-muted-foreground">
        Credits cover AI actions (chat, drafting, voice). Included with your plan and reset monthly.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col border rounded-lg overflow-hidden">
      <div class="bg-muted/50 p-4 border-b">
        <Skeleton class="h-6 w-40" />
      </div>
      <div class="p-4 flex flex-col gap-3">
        <Skeleton class="h-3 w-full" />
        <Skeleton class="h-4 w-32" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border rounded-lg p-4 text-sm text-muted-foreground">
      Couldn't load AI usage. <button class="underline" @click="load">Retry</button>
    </div>

    <!-- Loaded -->
    <div v-else-if="usage" class="flex flex-col border rounded-lg overflow-hidden">
      <!-- State banner: degrade / block -->
      <div
        v-if="usage.state !== 'normal'"
        class="p-3 text-sm flex flex-row items-start gap-2 border-b"
        :class="usage.state === 'blocked'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'"
      >
        <Icon :name="usage.state === 'blocked' ? 'lucide:lock' : 'lucide:zap'" class="size-4 mt-0.5 shrink-0" />
        <span>
          <template v-if="usage.state === 'blocked'">
            AI is locked — the credit limit has been reached. {{ canTopUp ? 'Top up to unlock it.' : 'Ask an admin to top up.' }}
          </template>
          <template v-else>
            Running on the lighter model — the pool is used up. {{ canTopUp ? 'Top up to restore full power.' : 'Replies stay available but lighter.' }}
          </template>
        </span>
      </div>

      <!-- Header: the POOL is the primary number (it's what gates access) -->
      <div class="bg-muted/50 p-4 border-b flex flex-col gap-3">
        <div class="flex flex-row items-start justify-between gap-3">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-muted-foreground">
              {{ usage.is_solo ? 'Your AI credits' : 'Team AI pool' }}
            </span>
            <span class="text-2xl ibm-plex-serif font-semibold">
              {{ fmt(usage.pool_used) }} / {{ fmt(total) }}
            </span>
            <span class="text-xs text-muted-foreground">{{ periodLabel }}</span>
          </div>
          <Badge :variant="atCap ? 'destructive' : nearCap ? 'secondary' : 'outline'">
            {{ atCap ? 'Pool used up' : nearCap ? `${pct}% used` : `${remaining} left` }}
          </Badge>
        </div>

        <!-- Pool bar -->
        <Progress :model-value="pct" :indicator="barClass" />
        <p v-if="nearCap" class="text-xs text-muted-foreground">
          <template v-if="atCap">
            The shared pool is used up. AI stays available on the lighter model; top up to restore full power.
          </template>
          <template v-else>
            You're approaching the monthly pool. Heavy users may want to ease off so the team has room.
          </template>
        </p>
      </div>

      <!-- Overage balance (prepaid top-ups that extend the pool) -->
      <div
        v-if="usage.overage_balance > 0"
        class="p-4 flex flex-row items-center justify-between text-sm border-b"
      >
        <span class="text-muted-foreground">Top-up balance</span>
        <span class="font-medium tabular-nums">{{ fmt(usage.overage_balance) }} credits</span>
      </div>

      <!-- Your own usage (member view) -->
      <div v-if="!usage.is_solo" class="p-4 flex flex-row items-center justify-between text-sm border-b">
        <span class="text-muted-foreground">You've used</span>
        <span class="font-medium">
          {{ fmt(usage.your_used) }}
          <span class="text-muted-foreground font-normal">
            / {{ fmt(usage.per_seat_guide) }} guide
          </span>
        </span>
      </div>

      <!-- Admin: per-member breakdown -->
      <div v-if="usage.is_admin && usage.per_member?.length" class="p-4 flex flex-col gap-2 border-b">
        <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Per member</span>
        <div
          v-for="m in sortedMembers"
          :key="m.userId"
          class="flex flex-row items-center justify-between text-sm py-1"
        >
          <div class="flex flex-col">
            <span class="font-medium">{{ m.name || m.email || 'Member' }}</span>
            <span v-if="m.name && m.email" class="text-xs text-muted-foreground">{{ m.email }}</span>
          </div>
          <span class="font-medium tabular-nums">{{ fmt(m.used) }}</span>
        </div>
      </div>

      <!-- Top-up control (admin for teams, or solo) -->
      <div v-if="canTopUp" class="p-4 flex flex-row items-center justify-between gap-3">
        <div class="flex flex-col">
          <span class="text-sm font-medium">Need more?</span>
          <span class="text-xs text-muted-foreground">Top-up credits never expire and kick in once the pool runs out.</span>
        </div>
        <Dialog v-model:open="topUpOpen">
          <DialogTrigger as-child>
            <Button size="sm" variant="outline">Top up</Button>
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
                  {{ usage.is_solo ? '' : 'team ' }}pool once payment is confirmed.
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
                <Button variant="ghost" :disabled="working" @click="closeTopUp">Cancel</Button>
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
                <Button @click="closeTopUp">{{ settled ? 'Done' : 'Close' }}</Button>
              </DialogFooter>
            </template>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import dayjs from 'dayjs';
import {
  purchaseCredits,
  openCheckout,
  waitForPayment,
  checkoutTokenFromURL,
  type CreditPurchase,
} from '~/services/billing';
import { useAiUsage } from '~/composables/useAiUsage';

// Use the SHARED usage state so a top-up here updates the header gauge and the
// chat credit gate too — they all read the same source of truth.
const { usage, loading, refresh } = useAiUsage();
const error = ref(false);

async function load() {
  error.value = false;
  await refresh();
  // refresh() keeps the last good value on failure, so a still-null usage after
  // it resolves means the (first) fetch failed — surface the retry affordance.
  if (!usage.value) error.value = true;
}

onMounted(load);

const fmt = (n: number) => Math.round(n).toLocaleString();

// The headline total absorbs prepaid top-ups: usable pool = monthly allowance +
// overage balance, matching what the credit gate spends against.
const total = computed(() =>
  usage.value ? usage.value.pool_total + usage.value.overage_balance : 0,
);

const pct = computed(() => {
  if (!usage.value || total.value <= 0) return 0;
  return Math.min(100, Math.round((usage.value.pool_used / total.value) * 100));
});

const remaining = computed(() =>
  usage.value ? fmt(Math.max(0, total.value - usage.value.pool_used)) : '0',
);

// Match the strategy guardrails: only get loud at ≥80%; "cap" degrades, not blocks.
const nearCap = computed(() => pct.value >= 80);
const atCap = computed(() => pct.value >= 100);

const barClass = computed(() =>
  atCap.value ? 'bg-destructive' : nearCap.value ? 'bg-amber-500' : '',
);

const periodLabel = computed(() =>
  usage.value ? dayjs(usage.value.period_start).format('MMMM YYYY') : '',
);

const sortedMembers = computed(() =>
  usage.value?.per_member ? [...usage.value.per_member].sort((a, b) => b.used - a.used) : [],
);

// Solo users top up their own pool; team top-ups are admin-only (server-enforced).
const canTopUp = computed(() => !!usage.value && (usage.value.is_solo || usage.value.is_admin));

// Pack sizes are ours; the PRICE is the server's. The rate used to be written
// out here as three fixed labels (50,000 / 100,000 / 200,000 UGX at 200
// UGX/credit), which quoted a figure the invoice did not have to agree with —
// the backend prices from AI_OVERAGE_UGX_PER_CREDIT, and nothing kept the two
// in step. Only the sizes are declared here now.
const packSizes = [250, 500, 1000];

const creditRate = computed(() => usage.value?.overage_ugx_per_credit ?? 0);

const packs = computed(() =>
  packSizes.map((credits) => ({
    credits,
    // No rate yet (usage still loading) means no price claim at all. Showing a
    // guess is what this change exists to stop.
    priceLabel: creditRate.value > 0
      ? `${(credits * creditRate.value).toLocaleString()} UGX`
      : '',
  })),
);

const topUpOpen = ref(false);
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
    await load();
  } else {
    timedOut.value = true;
  }
}

async function reopenCheckout() {
  if (purchase.value) await openCheckout(purchase.value.checkout_url);
}

function closeTopUp() {
  pollAbort?.abort();
  pollAbort = null;
  topUpOpen.value = false;
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
