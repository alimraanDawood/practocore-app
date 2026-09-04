<script lang="ts" setup>
// The /main home is now a thin shell over the shared <ChatSurface> (the single,
// reusable PractoAI chat used by every surface). This page owns only the light
// "home" dashboard shown in the chat's empty state — a stateful greeting, the
// deadlines that need the user soon, and recently-touched matters — passed in via
// ChatSurface's #empty slot. Mode is left at '' so this is the normal assistant,
// sharing history with the global sidebar.
import {
  Loader2, CalendarClock, CircleAlert, Clock, Scale, ArrowRight, Sparkles,
  Copy, RotateCcw, ListChecks, MessageSquareText, CheckCheck,
} from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { toast } from 'vue-sonner';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue';
import { getSignedInUser } from '~/services/auth';
import { getMatters, getAllDeadlines, completeAdhocDeadline } from '~/services/matters';
import { isAdhoc } from '~/services/deadlines/urgency';

const firstName = computed(() => getSignedInUser()?.name?.split(' ').at(0) || 'there');

// ── Home summary (assigned to me) ───────────────────────────────────────────
const uid = computed(() => getSignedInUser()?.id ?? '');
// Active workspace. Deadlines are read straight from PocketBase, so — unlike the
// matters half of this card, which goes through /api/practocore/matters and is
// scoped server-side — nothing here narrows them to the workspace the user is
// actually in. Scope them the same way the matters endpoint does: personal
// account => organisation-less matters only, firm => that firm's matters only.
const orgId = computed(() => getSignedInUser()?.organisation ?? '');
const homeLoading = ref(false);

interface HomeDeadline {
  id: string;
  name?: string;
  date?: string;
  status?: string;
  matter?: string;
  /** The engine node a FULFILL action targets; absent on a firm's own ad-hoc rows. */
  t_id?: string;
  origin?: string;
  input_prompt?: string;
  disableFulfill?: boolean;
  expand?: { matter?: { id: string; name?: string } }
}

interface HomeMatter {
  id: string;
  name?: string;
  caseNumber?: string
}

const myDeadlines = ref<HomeDeadline[]>([]);
const recentMatters = ref<HomeMatter[]>([]);

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const workspaceScope = computed(() =>
  orgId.value ? `matter.organisation = "${orgId.value}"` : 'matter.organisation = null');

async function loadHome() {
  const id = uid.value;
  if (!id) return;
  homeLoading.value = true;
  try {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 7);
    const horizonStr = `${horizon.toISOString().slice(0, 10)} 23:59:59`;
    const [dls, matters] = await Promise.all([
      getAllDeadlines({
        filter: `${workspaceScope.value} && assignees ~ "${id}" && (status = "pending" || status = "overdue") && date != "" && date <= "${horizonStr}"`,
        sort: 'date',
        expand: 'matter',
        // `t_id` (the engine node the FULFILL action targets), `origin`, `input_prompt`
        // and `disableFulfill` are here for the row's "Mark done…" menu item, which
        // opens the same completion dialog the matter timeline uses.
        fields: 'id,name,date,status,matter,t_id,origin,input_prompt,disableFulfill,expand.matter.id,expand.matter.name',
      }),
      getMatters(1, 5, {
        filter: `owner = "${id}" || members ~ "${id}" || supervisors ~ "${id}"`,
        sort: '-updated',
      }),
    ]);
    myDeadlines.value = (dls as HomeDeadline[]) ?? [];
    recentMatters.value = (matters?.items ?? []) as HomeMatter[];
  } catch {
    // Leave empty — the greeting falls back to "all clear".
  } finally {
    homeLoading.value = false;
  }
}

// Bucket assigned deadlines by urgency for the "Needs you" card.
const buckets = computed(() => {
  const today0 = startOfTodayMs();
  const todayEnd = today0 + 86_400_000 - 1;
  const overdue: HomeDeadline[] = [], today: HomeDeadline[] = [], week: HomeDeadline[] = [];
  for (const d of myDeadlines.value) {
    if (!d.date) continue;
    const t = new Date(d.date).getTime();
    if (t < today0) overdue.push(d);
    else if (t <= todayEnd) today.push(d);
    else week.push(d);
  }
  return {overdue, today, week};
});

const needsTodayCount = computed(() => buckets.value.overdue.length + buckets.value.today.length);
const dueThisWeekCount = computed(() => myDeadlines.value.length);

const greetingTime = computed(() => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
});

const greetingSummary = computed(() => {
  const week = dueThisWeekCount.value;
  if (!week) return 'you’re all clear this week.';
  const parts = [`${week} deadline${week === 1 ? '' : 's'} this week`];
  if (needsTodayCount.value) parts.push(`${needsTodayCount.value} need${needsTodayCount.value === 1 ? 's' : ''} you today`);
  return `${parts.join(', ')}.`;
});

/** "Today" / "Tomorrow" / "in 3d" / "2d overdue" relative to the local day. */
function dueLabel(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - startOfTodayMs()) / 86_400_000);
  if (diff < 0) return `${-diff}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `in ${diff}d`;
}

const deadlineGroups = computed(() => [
  {key: 'overdue', label: 'Overdue', tone: 'text-destructive', items: buckets.value.overdue},
  {key: 'today', label: 'Today', tone: 'text-amber-600 dark:text-amber-500', items: buckets.value.today},
  {key: 'week', label: 'This week', tone: 'text-muted-foreground', items: buckets.value.week},
].filter(g => g.items.length));

const smartPrompts = [
  'What’s on my plate today?',
  'Summarise what changed in my matters this week',
  'Which of my deadlines are most urgent?',
];

function matterIdOf(d: HomeDeadline): string | undefined {
  return d.matter || d.expand?.matter?.id;
}

function openDeadline(d: HomeDeadline) {
  const mid = matterIdOf(d);
  if (mid) navigateTo(`/main/matters/matter/${mid}`);
}

function openMatter(id: string) {
  navigateTo(`/main/matters/matter/${id}`);
}

// ── Completing a deadline from here ─────────────────────────────────────────
// The one write this card offers. It is the verb a "needs you" list owes the
// user, and it is never a one-click write on an engine row: the menu item opens
// the SAME dialog the matter timeline opens, because completion records a date
// and can carry evidence. Only a firm's own ad-hoc row completes outright — it
// is not an engine node, so there is no date to record and nothing to cascade,
// exactly as the timeline treats it.
const completeFor = ref<HomeDeadline | null>(null);
const adhocBusy = ref<string | null>(null);

// A menu and a dialog are separate overlay layers; opening the second while the
// first is still closing makes them race for the body scroll lock (CLAUDE.md).
const defer = (fn: () => void) => setTimeout(fn, 0);

// The same gate the timeline carries, said out loud in the label instead of
// greying an item with no explanation.
const planActive = usePlanActive();
const { isOffline: netOffline } = useNetwork();
const completeBlocked = computed(() => {
  if (netOffline.value) return 'offline';
  if (!planActive.value?.active) return 'subscription expired';
  return '';
});

async function completeAdhoc(d: HomeDeadline) {
  adhocBusy.value = d.id;
  try {
    const res = await completeAdhocDeadline(d.id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Deadline marked done');
    await loadHome();
  } catch (err: any) {
    toast.error(err?.message || 'Could not update deadline');
  } finally {
    adhocBusy.value = null;
  }
}

// ── Right-click menus ───────────────────────────────────────────────────────
// ONE menu per list, not one per row: a menu per row makes each its own
// dismissable layer, so right-clicking a second row leaves the first standing.
// The list clears the aim in the capture phase, each row sets it in the target
// phase, and reka re-anchors the single menu at the new point. Touch has no
// context menu — reka's trigger arms a long-press of its own, and a tap already
// opens the row.
const coarsePointer = useMediaQuery('(pointer: coarse)');
const ctxDeadline = ref<HomeDeadline | null>(null);
const ctxMatter = ref<HomeMatter | null>(null);

/** ChatSurface's `ask` (seeds the composer) / `send` (fires immediately), passed
 *  down from the slot because the actions are described here in script. */
type AskFn = (text: string) => void;

function copyText(text: string, what: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${what} copied to clipboard`);
}

/** What the deadline row under the pointer can do — the row's own actions, in a menu. */
function deadlineActions(d: HomeDeadline, ask: AskFn): MenuAction[] {
  const matterName = d.expand?.matter?.name || 'this matter';
  const name = d.name || 'Deadline';
  const blocked = completeBlocked.value;
  const suffix = blocked ? ` — ${blocked}` : '';
  const out: MenuAction[] = [
    {
      id: 'open', label: 'Open matter', icon: ArrowRight,
      disabled: !matterIdOf(d), run: () => openDeadline(d),
    },
  ];

  // Ad-hoc rows complete outright; engine rows go through the dialog, which is
  // where the fulfilled date (and any evidence) is actually chosen.
  if (isAdhoc(d)) {
    out.push({
      id: 'done', label: `Mark done${suffix}`, icon: CheckCheck, divider: true,
      disabled: !!blocked || adhocBusy.value === d.id, run: () => completeAdhoc(d),
    });
  } else if (!d.disableFulfill) {
    out.push({
      id: 'done', label: `Mark done…${suffix}`, icon: CheckCheck, divider: true,
      disabled: !!blocked, run: () => defer(() => { completeFor.value = d; }),
    });
  }

  out.push({
    id: 'ask', label: 'Ask PractoAI about this', icon: Sparkles, divider: true,
    run: () => ask(`Tell me about the “${name}” deadline on ${matterName} and what I need to do.`),
  });
  out.push({
    id: 'next', label: 'Ask what to do next', icon: MessageSquareText,
    run: () => ask(`What are the next steps for “${name}” on ${matterName}, and by when?`),
  });
  out.push({
    id: 'copy', label: 'Copy deadline name', icon: Copy, divider: true,
    run: () => copyText(name, 'Deadline name'),
  });
  return out;
}

/** The menu on the deadlines card itself, rather than on any one row. */
function deadlineSurfaceActions(send: AskFn): MenuAction[] {
  return [
    { id: 'calendar', label: 'Open the calendar', icon: CalendarClock, run: () => navigateTo('/main/calendar') },
    { id: 'plate', label: 'Ask what’s on my plate', icon: ListChecks, run: () => send('What’s on my plate today?') },
    { id: 'refresh', label: 'Refresh', icon: RotateCcw, divider: true, disabled: homeLoading.value, run: loadHome },
  ];
}

/** What the matter row under the pointer can do. */
function matterActions(m: HomeMatter, ask: AskFn): MenuAction[] {
  const name = m.name || 'Matter';
  const out: MenuAction[] = [
    { id: 'open', label: 'Open matter', icon: ArrowRight, run: () => openMatter(m.id) },
    {
      id: 'ask', label: 'Ask PractoAI about this', icon: Sparkles, divider: true,
      run: () => ask(`Summarise recent activity on the matter “${name}”.`),
    },
    {
      id: 'outstanding', label: 'Ask what’s outstanding', icon: ListChecks,
      run: () => ask(`What is outstanding on the matter “${name}”?`),
    },
    {
      id: 'copy-name', label: 'Copy matter name', icon: Copy, divider: true,
      run: () => copyText(name, 'Matter name'),
    },
  ];
  if (m.caseNumber) {
    out.push({
      id: 'copy-case', label: 'Copy case number', icon: Copy,
      run: () => copyText(m.caseNumber!, 'Case number'),
    });
  }
  return out;
}

/** The menu on the recent-matters list itself. */
const matterSurfaceActions = computed<MenuAction[]>(() => [
  { id: 'all', label: 'View all matters', icon: Scale, run: () => navigateTo('/main/matters') },
  { id: 'refresh', label: 'Refresh', icon: RotateCcw, divider: true, disabled: homeLoading.value, run: loadHome },
]);

onMounted(loadHome);
</script>

<template>
  <ChatSurface class="h-full" workspace-preview>
    <!-- Empty-state "home" dashboard. `ask` seeds the composer; `send` fires immediately. -->
    <template #empty="{ ask, send }">
      <div class="flex w-full flex-col gap-6">
        <!-- Stateful greeting -->
        <div class="flex items-center gap-3">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold ibm-plex-serif leading-tight">{{ greetingTime }}, {{ firstName }}</h1>
            <p class="text-sm text-muted-foreground">{{ greetingSummary }}</p>
          </div>
        </div>

        <!-- Needs you — assigned deadlines due soon -->
        <div v-if="homeLoading"
             class="flex items-center gap-2 rounded-xl border px-4 py-5 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin"/>
          Loading your day…
        </div>
        <div v-else-if="deadlineGroups.length" class="rounded overflow-hidden border lg:bg-background bg-muted">
          <ContextMenu>
          <ContextMenuTrigger as-child :disabled="coarsePointer">
          <div @contextmenu.capture="ctxDeadline = null">
          <div class="flex items-center gap-2 border-b px-4 py-2.5">
            <CalendarClock class="size-4 text-muted-foreground"/>
            <span class="text-sm font-semibold">Needs you</span>
            <Badge variant="secondary" class="ml-auto px-1.5 text-xs">{{ dueThisWeekCount }}</Badge>
          </div>
          <div v-for="group in deadlineGroups" :key="group.key">
            <p class="px-4 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide" :class="group.tone">
              {{ group.label }}
            </p>
            <button v-for="d in group.items" :key="d.id"
                    class="group/dl flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent"
                    @click="openDeadline(d)"
                    @contextmenu="ctxDeadline = d">
              <CircleAlert v-if="group.key === 'overdue'" class="size-4 shrink-0 text-destructive"/>
              <Clock v-else class="size-4 shrink-0 text-muted-foreground"/>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ d.name || 'Deadline' }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ d.expand?.matter?.name || 'Matter' }}</span>
              </div>
              <span class="shrink-0 text-xs font-medium" :class="group.tone">{{ dueLabel(d.date) }}</span>
              <span
                  class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-primary group-hover/dl:opacity-100"
                  title="Ask PractoAI about this"
                  @click.stop="ask(`Tell me about the “${d.name}” deadline on ${d.expand?.matter?.name || 'this matter'} and what I need to do.`)">
                <Sparkles class="size-3.5"/>
              </span>
            </button>
          </div>
          </div>
          </ContextMenuTrigger>
          <ContextMenuContent class="w-64">
            <SharedActionMenuItems
                :actions="ctxDeadline ? deadlineActions(ctxDeadline, ask) : deadlineSurfaceActions(send)"
                variant="context"/>
          </ContextMenuContent>
          </ContextMenu>
        </div>

        <!-- Recent matters -->
        <div v-if="!homeLoading && recentMatters.length" class="flex flex-col gap-1.5">
          <div class="flex flex-row items-center justify-between">
            <p class="font-medium ibm-plex-serif">Recent matters</p>
            <NuxtLink to="/main/matters">
              <Button size="xs" variant="secondary">View All</Button>
            </NuxtLink>
          </div>
          <ContextMenu>
          <ContextMenuTrigger as-child :disabled="coarsePointer">
          <div class="flex flex-col" @contextmenu.capture="ctxMatter = null">
            <button v-for="m in recentMatters" :key="m.id"
                    class="group/m flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                    @click="openMatter(m.id)"
                    @contextmenu="ctxMatter = m">
              <div class="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Scale class="size-3.5"/>
              </div>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ m.name || 'Matter' }}</span>
                <span v-if="m.caseNumber" class="truncate text-xs text-muted-foreground">{{ m.caseNumber }}</span>
              </div>
              <span
                  class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-primary group-hover/m:opacity-100"
                  title="Ask PractoAI about this"
                  @click.stop="ask(`Summarise recent activity on the matter “${m.name}”.`)">
                <Sparkles class="size-3.5"/>
              </span>
              <ArrowRight
                  class="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover/m:translate-x-0.5"/>
            </button>
          </div>
          </ContextMenuTrigger>
          <ContextMenuContent class="w-64">
            <SharedActionMenuItems
                :actions="ctxMatter ? matterActions(ctxMatter, ask) : matterSurfaceActions"
                variant="context"/>
          </ContextMenuContent>
          </ContextMenu>
        </div>

        <!-- Smart prompts -->
        <div class="flex flex-wrap gap-2">
          <button v-for="p in smartPrompts" :key="p"
                  class="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  @click="send(p)">
            {{ p }}
          </button>
        </div>

        <!-- Completion, opened from the row menu rather than from a button of its
             own. Mounted only while open and keyed by row, because it seeds its
             form from the deadline it was opened on. The empty span is the
             trigger slot it expects; nothing renders it. -->
        <SharedDeadlineCompleteDeadline
            v-if="completeFor"
            :key="`complete-${completeFor.id}`"
            :deadline="completeFor"
            :open="true"
            @update:open="(v: boolean) => { if (!v) completeFor = null; }"
            @updated="loadHome">
          <span class="hidden"/>
        </SharedDeadlineCompleteDeadline>
      </div>
    </template>
  </ChatSurface>
</template>
