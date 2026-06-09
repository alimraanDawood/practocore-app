<script setup lang="ts">
import { BellRing, CalendarClock, Briefcase, User, Users, Check, Loader2, CheckCircle2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { getReminders, markReminderDone } from '~/services/reminders';
import { getSignedInUser } from '~/services/auth';

const loading = ref(true);
const tasks = ref<any[]>([]);
const busy = ref<Record<string, boolean>>({});

const today = new Date();
today.setHours(0, 0, 0, 0);

const isDone = (t: any) => t.status === 'done' || t.status === 'cancelled';
const dueDate = (t: any) => (t.targetDate ? new Date(t.targetDate) : null);
const isOverdue = (t: any) => !isDone(t) && dueDate(t) !== null && (dueDate(t) as Date) < today;

const upcoming = computed(() => tasks.value.filter((t) => !isDone(t) && !isOverdue(t)));
const overdue = computed(() => tasks.value.filter((t) => isOverdue(t)));
const done = computed(() => tasks.value.filter((t) => isDone(t)));

const scopeLabel = (t: any) => t.expand?.matter?.name || 'Personal';
const isCase = (t: any) => !!t.expand?.matter;

const me = getSignedInUser()?.id;
// Reminder I created for other people → "For A, B". A reminder someone else set
// for me → "From <owner>". Self-reminders show neither.
const recipientNames = (t: any) =>
  (t.expand?.recipients ?? []).filter((r: any) => r.id !== me).map((r: any) => r.name).filter(Boolean);
const isForOthers = (t: any) => t.owner === me && recipientNames(t).length > 0;
const isFromOther = (t: any) => t.owner !== me;
const ownerName = (t: any) => t.expand?.owner?.name || 'Someone';

const fmt = (raw?: string) => {
  if (!raw) return '';
  const iso = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// "13:45" -> "1:45 PM"; empty -> "".
const fmtTime = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

// "Mon, 5 Jun 2026" or "Mon, 5 Jun 2026 · 1:45 PM" when a time is set.
const fmtDue = (t: any) => (t.atTime ? `${fmt(t.targetDate)} · ${fmtTime(t.atTime)}` : fmt(t.targetDate));

async function load() {
  const user = getSignedInUser();
  if (!user?.id) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    tasks.value = await getReminders(user.id);
  } catch (e) {
    console.error(e);
    toast.error('Failed to load reminders');
  } finally {
    loading.value = false;
  }
}

async function markDone(t: any) {
  busy.value = { ...busy.value, [t.id]: true };
  try {
    await markReminderDone(t.id);
    t.status = 'done';
    toast('Reminder completed', { description: `"${t.title}" marked done — remaining nudges cancelled.` });
  } catch (e) {
    console.error(e);
    toast.error('Could not mark reminder done');
  } finally {
    busy.value = { ...busy.value, [t.id]: false };
  }
}

onMounted(load);
</script>

<template>
  <div class="flex flex-col lg:w-[95vw] w-full h-full overflow-y-auto border-x">
    <div class="flex flex-col w-full max-w-3xl mx-auto p-5 gap-6">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <div class="size-9 rounded-full grid place-items-center bg-primary/10 text-primary shrink-0">
          <BellRing class="size-4" />
        </div>
        <div>
          <h1 class="text-lg font-semibold leading-tight">Reminders</h1>
          <p class="text-sm text-muted-foreground">Personal and case nudges you scheduled. Ask the assistant to add more.</p>
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 class="size-5 animate-spin" />
      </div>

      <div v-else-if="tasks.length === 0" class="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <BellRing class="size-8 text-muted-foreground/50" />
        <p class="font-medium">No reminders yet</p>
        <p class="text-sm text-muted-foreground max-w-sm">
          Try telling the assistant something like “Remind me to file the Mukama suit by Monday”.
        </p>
      </div>

      <template v-else>
        <!-- Overdue -->
        <section v-if="overdue.length" class="flex flex-col gap-2">
          <h2 class="text-[11px] uppercase tracking-wide font-medium text-destructive">Overdue</h2>
          <div
            v-for="t in overdue" :key="t.id"
            class="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-sm font-medium truncate">{{ t.title }}</span>
              <div class="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" class="gap-1 text-[11px]">
                  <component :is="isCase(t) ? Briefcase : User" class="size-3" /> {{ scopeLabel(t) }}
                </Badge>
                <Badge v-if="isForOthers(t)" variant="secondary" class="gap-1 text-[11px]">
                  <Users class="size-3" /> For {{ recipientNames(t).join(', ') }}
                </Badge>
                <Badge v-else-if="isFromOther(t)" variant="secondary" class="gap-1 text-[11px]">
                  <User class="size-3" /> From {{ ownerName(t) }}
                </Badge>
                <span class="text-[11px] flex items-center gap-1 text-destructive">
                  <CalendarClock class="size-3" /> Was due {{ fmtDue(t) }}
                </span>
              </div>
            </div>
            <Button size="sm" variant="outline" class="gap-1.5 shrink-0" :disabled="busy[t.id]" @click="markDone(t)">
              <Loader2 v-if="busy[t.id]" class="size-3.5 animate-spin" />
              <Check v-else class="size-3.5" /> Done
            </Button>
          </div>
        </section>

        <!-- Upcoming -->
        <section v-if="upcoming.length" class="flex flex-col gap-2">
          <h2 class="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Upcoming</h2>
          <div
            v-for="t in upcoming" :key="t.id"
            class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-sm font-medium truncate">{{ t.title }}</span>
              <div class="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" class="gap-1 text-[11px]">
                  <component :is="isCase(t) ? Briefcase : User" class="size-3" /> {{ scopeLabel(t) }}
                </Badge>
                <Badge v-if="isForOthers(t)" variant="secondary" class="gap-1 text-[11px]">
                  <Users class="size-3" /> For {{ recipientNames(t).join(', ') }}
                </Badge>
                <Badge v-else-if="isFromOther(t)" variant="secondary" class="gap-1 text-[11px]">
                  <User class="size-3" /> From {{ ownerName(t) }}
                </Badge>
                <span class="text-[11px] flex items-center gap-1 text-muted-foreground">
                  <CalendarClock class="size-3" /> Due {{ fmtDue(t) }}
                </span>
              </div>
            </div>
            <Button size="sm" variant="outline" class="gap-1.5 shrink-0" :disabled="busy[t.id]" @click="markDone(t)">
              <Loader2 v-if="busy[t.id]" class="size-3.5 animate-spin" />
              <Check v-else class="size-3.5" /> Done
            </Button>
          </div>
        </section>

        <!-- Done -->
        <section v-if="done.length" class="flex flex-col gap-2">
          <h2 class="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Completed</h2>
          <div
            v-for="t in done" :key="t.id"
            class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 opacity-60">
            <div class="flex items-center gap-2 min-w-0">
              <CheckCircle2 class="size-4 text-primary shrink-0" />
              <span class="text-sm line-through truncate">{{ t.title }}</span>
            </div>
            <span class="text-[11px] text-muted-foreground shrink-0">{{ fmtDue(t) }}</span>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
