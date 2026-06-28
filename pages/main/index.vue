<script lang="ts" setup>
// The /main home is now a thin shell over the shared <ChatSurface> (the single,
// reusable PractoAI chat used by every surface). This page owns only the light
// "home" dashboard shown in the chat's empty state — a stateful greeting, the
// deadlines that need the user soon, and recently-touched matters — passed in via
// ChatSurface's #empty slot. Mode is left at '' so this is the normal assistant,
// sharing history with the global sidebar.
import { Loader2, CalendarClock, CircleAlert, Clock, Scale, ArrowRight, Sparkles } from 'lucide-vue-next';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import { getSignedInUser } from '~/services/auth';
import { getMatters, getAllDeadlines } from '~/services/matters';

const firstName = computed(() => getSignedInUser()?.name?.split(' ').at(0) || 'there');

// ── Home summary (assigned to me) ───────────────────────────────────────────
const uid = computed(() => getSignedInUser()?.id ?? '');
const homeLoading = ref(false);

interface HomeDeadline {
  id: string;
  name?: string;
  date?: string;
  status?: string;
  matter?: string;
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
        filter: `assignees ~ "${id}" && (status = "pending" || status = "overdue") && date != "" && date <= "${horizonStr}"`,
        sort: 'date',
        expand: 'matter',
        fields: 'id,name,date,status,matter,expand.matter.id,expand.matter.name',
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

onMounted(loadHome);
</script>

<template>
  <ChatSurface class="h-full">
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
                    @click="openDeadline(d)">
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

        <!-- Recent matters -->
        <div v-if="!homeLoading && recentMatters.length" class="flex flex-col gap-1.5">
          <div class="flex flex-row items-center justify-between">
            <p class="font-medium ibm-plex-serif">Recent matters</p>
            <NuxtLink to="/main/matters">
              <Button size="xs" variant="secondary">View All</Button>
            </NuxtLink>
          </div>
          <div class="flex flex-col">
            <button v-for="m in recentMatters" :key="m.id"
                    class="group/m flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                    @click="openMatter(m.id)">
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
        </div>

        <!-- Smart prompts -->
        <div class="flex flex-wrap gap-2">
          <button v-for="p in smartPrompts" :key="p"
                  class="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  @click="send(p)">
            {{ p }}
          </button>
        </div>
      </div>
    </template>
  </ChatSurface>
</template>
