<template>
  <div class="ai-spend flex flex-col gap-5">
    <!-- Title + the ONE filter row. Period scopes every card below it; putting a
         range picker inside each card would let two cards disagree about what
         "this month" means. -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-semibold ibm-plex-serif">AI spending</h2>
        <p class="text-sm text-muted-foreground">
          Where your AI credits went{{ scopeNote }}. Credits are the unit your plan and
          top-ups are counted in.
        </p>
      </div>

      <div class="flex flex-row items-center gap-1 flex-wrap">
        <Button
          v-for="p in PERIODS"
          :key="p.key"
          size="sm"
          class="shrink-0"
          :variant="period === p.key ? 'secondary' : 'ghost'"
          :disabled="loading && period !== p.key"
          @click="select(p.key)"
        >{{ p.label }}</Button>
      </div>
    </div>

    <!-- Balance strip. The rest of this screen is spend that has already
         happened; this one row is what is LEFT, because "where did it go" and
         "can I keep going" are asked in the same breath — and it is where the
         top-up action belongs. The number comes from the shared usage state, so
         it agrees with the sidebar gauge and the chat credit gate rather than
         being a second derivation. -->
    <div
      v-if="pool"
      class="border rounded-lg px-4 py-3 flex flex-row items-center justify-between gap-3 flex-wrap"
      :class="poolState !== 'normal' ? 'border-amber-500/40' : ''"
    >
      <div class="flex flex-col gap-0.5">
        <span class="text-sm">
          <span class="font-semibold tabular-nums">{{ fmt(poolLeft) }}</span>
          <span class="text-muted-foreground"> credits left of {{ fmt(poolTotal) }}</span>
        </span>
        <span class="text-xs text-muted-foreground">
          <template v-if="poolState === 'blocked'">
            AI is locked until the pool is topped up.
          </template>
          <template v-else-if="poolState === 'degraded'">
            The pool is used up — AI is running on the lighter model.
          </template>
          <template v-else>
            {{ pool.is_solo ? 'Your allowance' : "Your firm's shared pool" }} resets monthly.
            <template v-if="pool.overage_balance > 0">
              Includes {{ fmt(pool.overage_balance) }} in top-ups.
            </template>
          </template>
        </span>
      </div>

      <SharedBillingTopUpCredits
        v-if="canTopUp"
        :is-solo="pool.is_solo"
        :variant="poolState === 'normal' ? 'outline' : 'default'"
        @settled="load()"
      />
      <span v-else-if="poolState !== 'normal'" class="text-xs text-muted-foreground">
        Ask an admin to top up.
      </span>
    </div>

    <!-- First load only. A refetch holds the previous render (see .is-stale) so
         switching period doesn't flash the whole page back to skeletons. -->
    <div v-if="!data && loading" class="flex flex-col gap-4">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton v-for="i in 4" :key="i" class="h-20 rounded-lg" />
      </div>
      <Skeleton class="h-64 rounded-lg" />
    </div>

    <div v-else-if="!data && error" class="border rounded-lg p-6 flex flex-col items-center gap-2 text-center">
      <Icon name="lucide:chart-column" class="size-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">Couldn't load your AI spending.</p>
      <Button size="sm" variant="outline" @click="load()">Try again</Button>
    </div>

    <div v-else-if="data" class="flex flex-col gap-5" :class="loading ? 'is-stale' : ''">
      <!-- ── Headline figures ───────────────────────────────────────────────
           Four numbers, not four charts: each is a single value, and a single
           value is a stat tile. -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="border rounded-lg p-3 flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground">Credits spent</span>
          <span class="text-2xl font-semibold leading-tight">{{ fmt(data.total) }}</span>
          <span class="text-xs text-muted-foreground">{{ data.period_label }}</span>
        </div>
        <div class="border rounded-lg p-3 flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground">{{ data.is_solo ? 'Daily average' : 'Your share' }}</span>
          <span class="text-2xl font-semibold leading-tight">
            {{ data.is_solo ? fmt(data.daily_avg) : fmt(data.your_total) }}
          </span>
          <span class="text-xs text-muted-foreground">
            <template v-if="data.is_solo">credits per day</template>
            <template v-else>{{ yourSharePct }}% of the firm's</template>
          </span>
        </div>
        <div class="border rounded-lg p-3 flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground">AI actions</span>
          <span class="text-2xl font-semibold leading-tight">{{ data.events.toLocaleString() }}</span>
          <span class="text-xs text-muted-foreground">metered this period</span>
        </div>
        <div class="border rounded-lg p-3 flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground">Busiest day</span>
          <span class="text-2xl font-semibold leading-tight">{{ peakLabel }}</span>
          <span class="text-xs text-muted-foreground">{{ peakSub }}</span>
        </div>
      </div>

      <!-- ── Spending over time ─────────────────────────────────────────────
           Bars, not a line: spend is a quantity accrued per day, and the gaps
           between busy days are part of what the reader is looking for. Days
           with no spend are drawn as empty columns rather than skipped, so a
           quiet fortnight looks quiet. -->
      <section class="border rounded-lg flex flex-col">
        <header class="p-4 pb-3 flex flex-row items-start justify-between gap-3 flex-wrap">
          <div class="flex flex-col gap-0.5">
            <h3 class="font-medium">Spending over time</h3>
            <p class="text-xs text-muted-foreground">Credits per day, {{ data.period_label.toLowerCase() }}</p>
          </div>
          <div class="flex flex-row items-center gap-3">
            <!-- Legend is always present for two series; identity is never
                 carried by colour alone. -->
            <div v-if="!data.is_solo" class="flex flex-row items-center gap-3 text-xs">
              <span class="flex flex-row items-center gap-1.5">
                <span class="size-2.5 rounded-[2px]" style="background: var(--viz-1)" />
                <span class="text-muted-foreground">You</span>
              </span>
              <span class="flex flex-row items-center gap-1.5">
                <span class="size-2.5 rounded-[2px]" style="background: var(--viz-2)" />
                <span class="text-muted-foreground">Rest of the firm</span>
              </span>
            </div>
            <Button size="sm" variant="ghost" class="text-xs h-7" @click="tableView = !tableView">
              {{ tableView ? 'Show chart' : 'Show table' }}
            </Button>
          </div>
        </header>

        <div v-if="data.total <= 0" class="px-4 pb-6 pt-2 text-sm text-muted-foreground">
          No AI credits were spent in this period.
        </div>

        <!-- Table twin: every value the chart encodes, reachable without colour
             or hover. -->
        <div v-else-if="tableView" class="px-4 pb-4 max-h-80 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-muted-foreground">
              <tr class="border-b">
                <th class="text-left font-medium py-1.5">Day</th>
                <th v-if="!data.is_solo" class="text-right font-medium py-1.5">You</th>
                <th v-if="!data.is_solo" class="text-right font-medium py-1.5">Rest of firm</th>
                <th class="text-right font-medium py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in spentDays" :key="d.date" class="border-b last:border-0">
                <td class="py-1.5">{{ dayLabel(d.date) }}</td>
                <td v-if="!data.is_solo" class="text-right tabular-nums">{{ fmt(d.yours) }}</td>
                <td v-if="!data.is_solo" class="text-right tabular-nums">{{ fmt(d.credits - d.yours) }}</td>
                <td class="text-right tabular-nums font-medium">{{ fmt(d.credits) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- The plot. The container carries the x-axis band too, so the labels
             are never cut off into a nested scrollbar. -->
        <div v-else class="px-4 pb-4 overflow-x-auto">
          <div class="relative" :style="{ minWidth: plotMinWidth }">
            <!-- Recessive solid hairline grid + its scale. -->
            <div class="relative h-[180px] ml-10">
              <div
                v-for="g in gridLines"
                :key="g.value"
                class="absolute left-0 right-0 border-t border-border/60"
                :style="{ bottom: g.pct + '%' }"
              >
                <span class="absolute -left-10 -top-2 w-9 text-right text-[10px] tabular-nums text-muted-foreground">
                  {{ fmt(g.value) }}
                </span>
              </div>

              <!-- One tab stop for the whole plot, then arrow keys walk the days.
                   A tabindex on each of up to ninety columns would make the chart
                   a wall the keyboard has to climb over. -->
              <div
                class="absolute inset-0 flex flex-row items-end gap-[2px] outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                tabindex="0"
                role="group"
                :aria-label="`Credits per day, ${data.period_label}. Use the arrow keys to step through the days.`"
                @keydown="onPlotKey"
                @focus="hover = hover ?? busiestDate"
                @blur="hover = null"
                @mouseleave="hover = null"
              >
                <div
                  v-for="d in data.series"
                  :key="d.date"
                  class="relative flex-1 h-full flex flex-col justify-end gap-[2px] min-w-[6px] cursor-default"
                  @mouseenter="hover = d.date"
                >
                  <!-- Top segment: the rest of the firm. Rounded data-end. -->
                  <div
                    v-if="!data.is_solo && d.credits - d.yours > 0"
                    class="rounded-t-[4px] transition-opacity"
                    :style="{ height: barPct(d.credits - d.yours), background: 'var(--viz-2)' }"
                    :class="hover && hover !== d.date ? 'opacity-40' : ''"
                  />
                  <!-- Bottom segment: you (or, solo, the whole bar). -->
                  <div
                    v-if="ownCredits(d) > 0"
                    class="transition-opacity"
                    :class="[
                      (data.is_solo || d.credits - d.yours <= 0) ? 'rounded-t-[4px]' : '',
                      hover && hover !== d.date ? 'opacity-40' : '',
                    ]"
                    :style="{ height: barPct(ownCredits(d)), background: 'var(--viz-1)' }"
                  />

                  <!-- Hover readout. Anchored to the column, flipped near the
                       right edge so it never runs off the card. -->
                  <div
                    v-if="hover === d.date"
                    class="absolute bottom-full mb-1.5 z-10 w-max max-w-[180px] rounded-md border bg-popover text-popover-foreground shadow-md px-2 py-1.5 text-xs pointer-events-none"
                    :class="tooltipSide(d.date)"
                  >
                    <div class="font-medium">{{ dayLabel(d.date) }}</div>
                    <div class="tabular-nums">{{ fmt(d.credits) }} credits</div>
                    <div v-if="!data.is_solo && d.credits > 0" class="text-muted-foreground tabular-nums">
                      you {{ fmt(d.yours) }} · firm {{ fmt(d.credits - d.yours) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- X axis: a label every few days, so they never collide. -->
            <div class="ml-10 mt-1.5 flex flex-row gap-[2px]">
              <div
                v-for="(d, i) in data.series"
                :key="d.date"
                class="flex-1 min-w-[6px] text-center text-[10px] text-muted-foreground truncate"
              >
                <span v-if="showTick(i)">{{ tickLabel(d.date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Where it went ──────────────────────────────────────────────────
           Ranked bar lists. One hue for every bar: length already encodes the
           amount, and colouring by rank would spend the only free channel
           restating it. Each row is directly labelled, so these double as the
           table view. -->
      <div class="grid lg:grid-cols-2 gap-4">
        <section v-for="panel in panels" :key="panel.key" class="border rounded-lg flex flex-col">
          <header class="p-4 pb-2 flex flex-col gap-0.5">
            <h3 class="font-medium">{{ panel.title }}</h3>
            <p class="text-xs text-muted-foreground">{{ panel.hint }}</p>
          </header>
          <div v-if="!panel.slices.length" class="px-4 pb-4 text-sm text-muted-foreground">
            {{ panel.empty }}
          </div>
          <ul v-else class="px-4 pb-4 flex flex-col gap-2.5">
            <li v-for="s in panel.slices" :key="s.key" class="flex flex-col gap-1">
              <div class="flex flex-row items-baseline justify-between gap-3 text-sm">
                <span class="truncate">{{ s.label }}</span>
                <span class="shrink-0 tabular-nums">
                  {{ fmt(s.credits) }}
                  <span class="text-muted-foreground text-xs">({{ sharePct(s.credits, panel.slices) }}%)</span>
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{ width: relWidth(s.credits, panel.slices), background: 'var(--viz-1)' }"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <!-- ── By whom (admins) ───────────────────────────────────────────────-->
      <section v-if="data.is_admin && data.by_member?.length" class="border rounded-lg flex flex-col">
        <header class="p-4 pb-2 flex flex-col gap-0.5">
          <h3 class="font-medium">Who spent it</h3>
          <p class="text-xs text-muted-foreground">
            Everyone who drew on the firm's pool this period. Background work — indexing,
            document scanning — is requested by the firm rather than by a person, and is
            listed as its own row.
          </p>
        </header>
        <div class="px-4 pb-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-muted-foreground">
              <tr class="border-b">
                <th class="text-left font-medium py-2">Member</th>
                <th class="text-right font-medium py-2">Actions</th>
                <th class="text-right font-medium py-2">Credits</th>
                <th class="text-right font-medium py-2 w-28">Share</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in data.by_member" :key="m.userId || 'background'" class="border-b last:border-0">
                <td class="py-2">
                  <div class="flex flex-col">
                    <span class="font-medium">{{ m.name || m.email || 'Member' }}</span>
                    <span v-if="m.name && m.email" class="text-xs text-muted-foreground">{{ m.email }}</span>
                  </div>
                </td>
                <td class="text-right tabular-nums text-muted-foreground">{{ m.events.toLocaleString() }}</td>
                <td class="text-right tabular-nums font-medium">{{ fmt(m.credits) }}</td>
                <td class="py-2">
                  <div class="flex flex-row items-center gap-2 justify-end">
                    <div class="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                      <div class="h-full rounded-full" :style="{ width: m.share + '%', background: 'var(--viz-1)' }" />
                    </div>
                    <span class="tabular-nums text-xs text-muted-foreground w-9 text-right">{{ Math.round(m.share) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="text-xs text-muted-foreground">
        Figures are credits drawn against your plan's pool and any top-up balance. They
        update as AI runs, so the current day is still moving.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import {
  getAiSpendBreakdown,
  type AiSpendBreakdown,
  type AiSpendPeriod,
  type AiSpendDay,
  type AiSpendSlice,
} from '~/services/ai';

import { useAiUsage } from '~/composables/useAiUsage';

const PERIODS: { key: AiSpendPeriod; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

// The remaining balance is /ai/usage's job, not the breakdown's — reusing the
// shared state keeps this screen, the gauge and the gate quoting one number.
const { usage: pool, refresh: refreshPool } = useAiUsage();

const poolTotal = computed(() => (pool.value ? pool.value.pool_total + pool.value.overage_balance : 0));
const poolLeft = computed(() => (pool.value ? Math.max(0, poolTotal.value - pool.value.pool_used) : 0));
const poolState = computed(() => pool.value?.state ?? 'normal');

// Solo practitioners buy their own credits; for a firm it is an admin decision
// (and the server enforces it either way).
const canTopUp = computed(() => !!pool.value && (pool.value.is_solo || pool.value.is_admin));

const data = ref<AiSpendBreakdown | null>(null);
const loading = ref(false);
const error = ref(false);
const period = ref<AiSpendPeriod>('month');
const tableView = ref(false);
const hover = ref<string | null>(null);

async function load(p: AiSpendPeriod = period.value) {
  loading.value = true;
  error.value = false;
  try {
    data.value = await getAiSpendBreakdown(p);
  } catch {
    // Keep the last good render rather than blanking the page — a stale chart
    // beats an empty one, and the period buttons stay usable.
    error.value = true;
  } finally {
    loading.value = false;
  }
}

// The plot is one tab stop; the arrows move the readout within it. Home/End jump
// to the ends of the range, and Escape lets the reader dismiss it without
// tabbing away.
function onPlotKey(e: KeyboardEvent) {
  const series = data.value?.series ?? [];
  if (!series.length) return;

  const current = series.findIndex((d) => d.date === hover.value);
  let next = current;
  switch (e.key) {
    case 'ArrowRight': next = current < 0 ? 0 : Math.min(series.length - 1, current + 1); break;
    case 'ArrowLeft': next = current < 0 ? series.length - 1 : Math.max(0, current - 1); break;
    case 'Home': next = 0; break;
    case 'End': next = series.length - 1; break;
    case 'Escape': hover.value = null; return;
    default: return;
  }
  e.preventDefault();
  hover.value = series[next].date;
}

function select(p: AiSpendPeriod) {
  if (p === period.value) return;
  period.value = p;
  hover.value = null;
  load(p);
}

onMounted(() => {
  load();
  if (!pool.value) refreshPool();
});

// Credits run from 0.3 (an embedding batch) to thousands (a research run), so a
// fixed precision is wrong at one end or the other.
function fmt(n: number): string {
  if (!n) return '0';
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

const scopeNote = computed(() => {
  if (!data.value || data.value.is_solo) return '';
  return data.value.is_admin ? ' across the firm' : " across your firm's shared pool";
});

const yourSharePct = computed(() => {
  const d = data.value;
  if (!d || d.total <= 0) return 0;
  return Math.round((d.your_total / d.total) * 100);
});

const spentDays = computed(() => (data.value?.series ?? []).filter((d) => d.credits > 0));

const peakLabel = computed(() => {
  const d = data.value;
  if (!d?.peak_day) return '—';
  return dayjs(d.peak_day).format('D MMM');
});

const peakSub = computed(() => {
  const d = data.value;
  if (!d?.peak_day) return 'nothing spent yet';
  const day = d.series.find((s) => s.date === d.peak_day);
  return day ? `${fmt(day.credits)} credits` : '';
});

// Where the keyboard readout starts: the day that actually cost something.
const busiestDate = computed(() => data.value?.peak_day ?? data.value?.series[0]?.date ?? null);

const maxDay = computed(() =>
  Math.max(0, ...(data.value?.series ?? []).map((d) => d.credits)),
);

function barPct(credits: number): string {
  if (maxDay.value <= 0) return '0%';
  // Floor a non-zero day at a visible sliver — a day that cost something should
  // never render as nothing at all.
  return `${Math.max(1.5, (credits / maxDay.value) * 100)}%`;
}

function ownCredits(d: AiSpendDay): number {
  return data.value?.is_solo ? d.credits : d.yours;
}

// Three solid hairlines (0, half, max). More than that and the grid competes
// with the bars.
const gridLines = computed(() => {
  const m = maxDay.value;
  if (m <= 0) return [];
  return [
    { value: 0, pct: 0 },
    { value: m / 2, pct: 50 },
    { value: m, pct: 100 },
  ];
});

// Below this the columns become slivers, so the plot scrolls sideways instead of
// squeezing 90 days into a phone.
const plotMinWidth = computed(() => {
  const n = data.value?.series.length ?? 0;
  return n > 31 ? `${n * 9 + 40}px` : '100%';
});

function dayLabel(date: string): string {
  return dayjs(date).format('ddd D MMM');
}

function tickLabel(date: string): string {
  return dayjs(date).format('D MMM');
}

// A label every Nth column, chosen so roughly six to eight ticks appear whatever
// the range — enough to orient, never enough to collide.
const tickEvery = computed(() => Math.max(1, Math.ceil((data.value?.series.length ?? 1) / 7)));
function showTick(i: number): boolean {
  return i % tickEvery.value === 0;
}

// Flip the tooltip toward the middle near either edge so it stays on the card.
function tooltipSide(date: string): string {
  const series = data.value?.series ?? [];
  const i = series.findIndex((d) => d.date === date);
  if (i <= 1) return 'left-0';
  if (i >= series.length - 2) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

function sliceMax(slices: AiSpendSlice[]): number {
  return Math.max(0, ...slices.map((s) => s.credits));
}

function relWidth(credits: number, slices: AiSpendSlice[]): string {
  const m = sliceMax(slices);
  if (m <= 0) return '0%';
  return `${Math.max(2, (credits / m) * 100)}%`;
}

function sharePct(credits: number, slices: AiSpendSlice[]): number {
  const total = slices.reduce((sum, s) => sum + s.credits, 0);
  if (total <= 0) return 0;
  return Math.round((credits / total) * 100);
}

const panels = computed(() => {
  const d = data.value;
  if (!d) return [];
  return [
    {
      key: 'activity',
      title: 'What it was spent on',
      hint: 'Credits by the work that used them',
      empty: 'Nothing spent in this period.',
      slices: d.by_activity,
    },
    {
      key: 'matter',
      title: d.matter_scope_is_self ? 'Your matters and engagements' : 'Matters and engagements',
      hint: d.matter_scope_is_self
        ? 'Your own AI work, by the matter it was opened against'
        : 'Credits by the matter or engagement the work belonged to',
      empty: 'No spend was linked to a matter or engagement.',
      slices: d.by_matter,
    },
    {
      key: 'model',
      title: 'Which model served it',
      hint: 'The same work costs very different amounts on different models',
      empty: 'Nothing spent in this period.',
      slices: d.by_model,
    },
  ];
});
</script>

<style>
/* Chart roles, defined once so the light/dark pair swaps in one place and the
   markup is written against roles rather than hex. Both steps are the reference
   categorical slots 1 and 2, validated against this app's own surfaces
   (#fbf8f1 light / #262626 dark): adjacent CVD ΔE 24.7 light / 26.8 dark,
   normal-vision ΔE 33.6 / 31.8, both above 3:1 contrast. */
.ai-spend {
  --viz-1: #2a78d6; /* you / the measure */
  --viz-2: #eb6834; /* the rest of the firm */
}

.dark .ai-spend {
  --viz-1: #3987e5;
  --viz-2: #d95926;
}

/* A refetch dims the previous render instead of tearing it down — no skeleton
   flash and no layout jump when the period changes. */
.ai-spend .is-stale {
  opacity: 0.55;
  transition: opacity 120ms ease-out;
}
</style>
