<template>
  <!-- The pill is identical on both platforms; only the surface it opens
       differs — a popover beside the sidebar on desktop, a bottom drawer on
       mobile (where a 288px popover anchored to a sidebar edge has nowhere to
       go). -->
  <component :is="isDesktop ? Popover : Sheet" v-if="usage" v-model:open="open">
    <component :is="isDesktop ? PopoverTrigger : SheetTrigger" as-child>
      <!-- Compact pill with an animated fill that ticks up as credits burn -->
      <button
        type="button"
        :title="tooltip"
        class="group flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors"
        :class="pillClass"
      >
        <component :is="stateIcon" v-if="stateIcon" class="size-3 shrink-0" />

        <span class="relative h-1.5 w-10 overflow-hidden rounded-full bg-foreground/10">
          <span
            class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
            :class="barClass"
            :style="{ width: pct + '%' }"
          />
        </span>

        <span class="tabular-nums font-medium whitespace-nowrap">
          {{ fmt(usage.pool_used) }}<span class="opacity-60">/{{ fmt(total) }}</span>
        </span>
      </button>
    </component>

    <component
      :is="isDesktop ? PopoverContent : SheetContent"
      v-bind="isDesktop
        ? { side: props.side, sideOffset: props.sideOffset, align: props.align, collisionPadding: 12, class: 'w-72 p-0 overflow-hidden' }
        : { side: 'bottom', hideX: true, class: 'gap-0 p-0 overflow-hidden rounded-t-xl' }"
    >
      <!-- Drawer grab handle — the X is suppressed because it would land on
           top of the period label in the header. -->
      <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
        <span class="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>

      <!-- Header. On mobile this doubles as the drawer's accessible title. -->
      <div class="flex items-center justify-between px-4 py-3 border-b">
        <component :is="isDesktop ? 'span' : SheetTitle" class="text-sm font-semibold">
          AI Credits
        </component>
        <span class="text-xs text-muted-foreground">{{ periodLabel }}</span>
      </div>
      <SheetDescription v-if="!isDesktop" class="sr-only">
        Your AI credit usage for this billing period.
      </SheetDescription>

      <!-- State note -->
      <div
        v-if="state !== 'normal'"
        class="px-4 py-2 text-xs flex items-center gap-1.5 border-b"
        :class="state === 'blocked'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-500'"
      >
        <component :is="stateIcon" class="size-3 shrink-0" />
        <span>
          {{ state === 'blocked' ? 'AI locked — top up to unlock.' : 'Pool used up — running on the lighter model.' }}
        </span>
      </div>

      <div class="p-4 flex flex-col gap-4">
        <!-- Org-wide / personal pool -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-baseline justify-between">
            <span class="text-xs text-muted-foreground">
              {{ usage.is_solo ? 'Your credits' : 'Organisation pool' }}
            </span>
            <span class="text-xs tabular-nums text-muted-foreground">{{ fmt(left) }} left</span>
          </div>
          <span class="text-lg font-semibold tabular-nums ibm-plex-serif">
            {{ fmt(usage.pool_used) }} <span class="text-muted-foreground font-normal">/ {{ fmt(total) }}</span>
          </span>
          <span class="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <span
              class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
              :class="barClass"
              :style="{ width: pct + '%' }"
            />
          </span>
        </div>

        <!-- Your share (team only) -->
        <div v-if="!usage.is_solo" class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">You've used</span>
          <span class="font-medium tabular-nums">
            {{ fmt(usage.your_used) }}
            <span class="text-muted-foreground font-normal">/ {{ fmt(usage.per_seat_guide) }} guide</span>
          </span>
        </div>

        <!-- Top-up balance -->
        <div v-if="usage.overage_balance > 0" class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Top-up balance</span>
          <span class="font-medium tabular-nums">{{ fmt(usage.overage_balance) }}</span>
        </div>
      </div>

      <!-- Billing link (inside the popover / drawer) -->
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 py-3 border-t text-sm hover:bg-muted transition-colors"
        @click="goBilling"
      >
        <span>Manage in Billing</span>
        <ArrowRight class="size-4 text-muted-foreground" />
      </button>
    </component>
  </component>

  <!-- Loading skeleton -->
  <div v-else class="h-6 w-16 rounded-full border bg-muted/40 animate-pulse" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { useMediaQuery } from '@vueuse/core';
import { Zap, Lock, ArrowRight } from 'lucide-vue-next';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from '~/components/ui/sheet';
import { useAiUsage } from '~/composables/useAiUsage';

// Below the tablet breakpoint the details surface becomes a bottom drawer. A
// reka-ui bottom Sheet is used rather than the vaul-vue Drawer: this gauge sits
// in the sidebar footer, which on mobile *is* a reka Sheet, and mixing the two
// libraries' body-lock managers races (see app CLAUDE.md → Nested Modals).
const isDesktop = useMediaQuery('(min-width: 768px)');

// Shared reactive state — the chat refreshes this after each round, so the
// gauge updates live without polling here.
// Placement of the details popover. Defaults to hanging below the pill (chat
// header); the sidebar footer passes side="right" so it opens beside the
// sidebar instead of flipping up over the footer for want of room below.
const props = withDefaults(defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}>(), {
  side: 'bottom',
  sideOffset: 4,
  align: 'end',
});

const { usage, refresh } = useAiUsage();
onMounted(() => { if (!usage.value) refresh(); });

const open = ref(false);

const fmt = (n?: number) => Math.round(n ?? 0).toLocaleString();

// The headline total absorbs prepaid top-ups: the usable pool is the monthly
// allowance plus any overage balance, matching what the credit gate actually
// spends against (Included + Overage).
const total = computed(() => {
  const u = usage.value;
  return u ? u.pool_total + u.overage_balance : 0;
});

const pct = computed(() => {
  const u = usage.value;
  if (!u || total.value <= 0) return 0;
  return Math.min(100, Math.round((u.pool_used / total.value) * 100));
});

const left = computed(() => {
  const u = usage.value;
  return u ? Math.max(0, total.value - u.pool_used) : 0;
});

const state = computed(() => usage.value?.state ?? 'normal');
const near = computed(() => pct.value >= 80);

const barClass = computed(() => {
  if (state.value === 'blocked' || pct.value >= 100) return 'bg-destructive';
  if (state.value === 'degraded' || near.value) return 'bg-amber-500';
  return 'bg-primary';
});

const pillClass = computed(() => {
  if (state.value === 'blocked') return 'border-destructive/40 text-destructive hover:bg-destructive/10';
  if (state.value === 'degraded') return 'border-amber-500/40 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10';
  return 'text-muted-foreground hover:bg-muted hover:text-foreground';
});

const stateIcon = computed(() =>
  state.value === 'blocked' ? Lock : state.value === 'degraded' ? Zap : null,
);

const periodLabel = computed(() =>
  usage.value ? dayjs(usage.value.period_start).format('MMMM YYYY') : '',
);

const tooltip = computed(() => {
  const u = usage.value;
  if (!u) return '';
  let t = `${fmt(u.pool_used)} of ${fmt(total.value)} credits used · ${fmt(left.value)} left`;
  if (u.overage_balance > 0) t += ` (incl. ${fmt(u.overage_balance)} top-up)`;
  return t;
});

const { settingsPath } = useSettingsLink();

function goBilling() {
  open.value = false;
  navigateTo(settingsPath('billing'));
}
</script>
