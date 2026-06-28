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
            <DialogHeader>
              <DialogTitle>Top up AI credits</DialogTitle>
              <DialogDescription>
                Choose a pack. Credits are added to your {{ usage.is_solo ? '' : 'team ' }}pool and used after the monthly allowance runs out.
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
                <span class="text-xs mt-1">{{ pack.priceLabel }}</span>
              </button>
            </div>
            <p v-if="topUpError" class="text-sm text-destructive">{{ topUpError }}</p>
            <DialogFooter>
              <Button variant="ghost" :disabled="toppingUp" @click="topUpOpen = false">Cancel</Button>
              <Button :disabled="toppingUp" @click="doTopUp">
                {{ toppingUp ? 'Processing…' : `Add ${fmt(selectedPack)} credits` }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { topUpCredits } from '~/services/ai';
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

// Packs mirror AI_CREDITS_STRATEGY.md §3 (~200 UGX/credit overage).
const packs = [
  { credits: 250, priceLabel: '50,000 UGX' },
  { credits: 500, priceLabel: '100,000 UGX' },
  { credits: 1000, priceLabel: '200,000 UGX' },
];

const topUpOpen = ref(false);
const selectedPack = ref(packs[1].credits);
const toppingUp = ref(false);
const topUpError = ref('');

async function doTopUp() {
  toppingUp.value = true;
  topUpError.value = '';
  try {
    await topUpCredits(selectedPack.value, true);
    topUpOpen.value = false;
    await load();
  } catch (e: any) {
    topUpError.value = e?.message ?? 'Top-up failed. Try again.';
  } finally {
    toppingUp.value = false;
  }
}
</script>
