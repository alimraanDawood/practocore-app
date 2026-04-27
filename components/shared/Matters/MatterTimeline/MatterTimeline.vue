<template>
  <!-- Loaded state -->
  <div v-if="matter !== null" class="flex flex-col gap-4">

    <!-- Filter bar -->
    <div class="flex flex-row gap-1">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        @click="activeFilter = tab.value"
        class="flex flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150"
        :class="activeFilter === tab.value
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
      >
        {{ tab.label }}
        <span
          class="text-xs rounded-md px-1 py-0.5 tabular-nums font-semibold leading-none"
          :class="activeFilter === tab.value ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'"
        >{{ tab.count }}</span>
      </button>
    </div>

    <!-- Timeline -->
    <div class="flex flex-col">

      <!-- Trigger date node -->
      <div class="flex flex-row">
        <div class="flex flex-col items-center w-9 shrink-0">
          <div class="size-7 bg-primary/15 rounded-full grid place-items-center border-2 border-primary shrink-0">
            <CalendarIcon class="size-3 text-primary"/>
          </div>
          <div class="w-0.5 flex-1 min-h-5 bg-border mt-0.5"></div>
        </div>
        <div class="flex flex-col py-1 pb-3 pl-2 gap-0.5">
          <span class="text-sm font-semibold ibm-plex-serif leading-snug">{{ matter?.triggerDateName || 'Trigger Date' }}</span>
          <span class="text-xs text-muted-foreground">
            {{ dayjs(matter.triggerDate).format('D MMM YYYY') }}
          </span>
        </div>
      </div>

      <!-- Empty state: all caught up -->
      <div
        v-if="activeFilter === 'active' && filteredDeadlines.length === 0 && doneCount > 0"
        class="flex flex-col items-start pl-2 py-4 gap-2"
      >
        <div class="flex flex-row items-center gap-2">
          <div class="size-7 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <CheckCheck class="size-3.5 text-primary"/>
          </div>
          <div class="flex flex-col pl-2">
            <span class="text-sm font-medium">All caught up</span>
            <span class="text-xs text-muted-foreground">
              {{ doneCount }} deadline{{ doneCount !== 1 ? 's' : '' }} completed
              <button @click="activeFilter = 'done'" class="text-primary hover:underline ml-1">View</button>
            </span>
          </div>
        </div>
      </div>

      <!-- Deadline items -->
      <div
        v-for="(deadline, index) in filteredDeadlines"
        :key="deadline.id"
        class="flex flex-row"
      >
        <!-- Left: connecting lines + status node -->
        <div class="flex flex-col items-center w-9 shrink-0">
          <div
            class="w-0.5 h-5 shrink-0"
            :class="lineClass(deadline)"
          ></div>
          <div
            class="size-7 shrink-0 rounded-full grid place-items-center transition-colors duration-200"
            :class="nodeClass(deadline)"
          >
            <component :is="nodeIconComponent(deadline)" class="size-3.5"/>
          </div>
          <div
            class="w-0.5 flex-1 min-h-4"
            :class="index === filteredDeadlines.length - 1 ? 'opacity-0' : lineClass(deadline)"
          ></div>
        </div>

        <!-- Right: compact row + expandable detail -->
        <div class="flex flex-col flex-1 min-w-0 pl-2">

          <!-- Clickable compact row -->
          <button
            class="flex flex-row items-center gap-2 py-1.5 w-full text-left rounded-lg hover:bg-muted/50 transition-colors duration-100 group -ml-1 pl-1 pr-1"
            @click="toggleExpand(deadline.id)"
          >
            <div class="flex flex-col flex-1 min-w-0">
              <!-- Application context -->
              <div v-if="deadline.application" class="flex flex-row items-center gap-1 mb-0.5">
                <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">App</span>
                <span class="text-[10px] text-muted-foreground">·</span>
                <span class="text-[10px] text-muted-foreground truncate">
                  {{ matter?.expand?.applications?.find(a => a.id === deadline.application)?.type }}
                </span>
              </div>

              <span
                class="text-sm font-medium leading-snug truncate"
                :class="deadline.status === 'fulfilled' ? 'text-muted-foreground' : 'text-foreground'"
              >{{ deadline.name }}</span>

              <div v-if="deadline.party_context" class="flex flex-row items-center gap-1 mt-0.5">
                <User class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] text-muted-foreground truncate">{{ deadline.party_context.party_name }}</span>
              </div>
            </div>

            <!-- Date / urgency -->
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="text-xs font-semibold tabular-nums" :class="urgencyTextClass(deadline)">
                {{ deadlineDateDisplay(deadline) }}
              </span>
              <span class="text-[10px] text-muted-foreground">{{ dayjs(deadline.date).format('D MMM') }}</span>
            </div>

            <ChevronDown
              class="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-150"
              :class="isExpanded(deadline.id) ? 'rotate-180' : ''"
            />
          </button>

          <!-- Expanded detail -->
          <div v-if="isExpanded(deadline.id)" class="flex flex-col gap-3 pb-5 pt-1 pr-1">

            <!-- Fulfilled deadline -->
            <template v-if="deadline.status === 'fulfilled'">
              <p
                v-if="deadline.fulfilled_prompt"
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="deadline.fulfilled_prompt.replace('<<date>>', `<b class='text-foreground'>${dayjs(deadline.date).format('D MMM YYYY')}</b>`)"
              ></p>
              <div class="flex flex-row gap-2 flex-wrap">
                <SharedDeadlineCompleteDeadline @updated="emits('updated')" :deadline="deadline">
                  <Button size="sm" variant="outline">
                    <CalendarIcon class="size-3"/>
                    {{ dayjs(deadline.date).format('D MMM YYYY') }}
                  </Button>
                </SharedDeadlineCompleteDeadline>
              </div>
            </template>

            <!-- Pending deadline (Deadlines collection) -->
            <template v-else-if="deadline.collectionName === 'Deadlines'">
              <p
                v-if="deadline.pending_prompt"
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="deadline.pending_prompt
                  .replace('<<date>>', `<b class='text-foreground'>${dayjs(deadline.date).format('D MMM YYYY')}</b>`)
                  .replace('<<from_now>>', `<b class='text-foreground'>${dayjs(deadline.date).fromNow()}</b>`)"
              ></p>

              <p v-if="deadline.input_prompt && !deadline.disableFulfill" class="text-sm text-muted-foreground">
                {{ deadline.input_prompt }}
              </p>

              <div class="flex flex-row gap-2 flex-wrap">
                <SharedDeadlineCompleteDeadline
                  v-if="!deadline.disableFulfill"
                  @updated="emits('updated')"
                  :deadline="deadline"
                >
                  <Button size="sm">
                    <CalendarIcon class="size-3"/>
                    Set Date
                  </Button>
                </SharedDeadlineCompleteDeadline>

                <AdjournDeadline @updated="emits('updated')" :deadline="deadline">
                  <Button size="sm" variant="outline">Adjourn</Button>
                </AdjournDeadline>
              </div>
            </template>

            <!-- Event record (not a Deadline) -->
            <template v-else>
              <p
                v-if="deadline.fulfilled_prompt"
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="deadline.fulfilled_prompt.replace('<<date>>', `<b class='text-foreground'>${dayjs(deadline.date).format('D MMM YYYY')}</b>`)"
              ></p>
              <div>
                <SharedEventsCompleteEvent :event="deadline" @updated="emits('updated')">
                  <Button size="sm">
                    <CalendarIcon class="size-3"/>
                    Set Date
                  </Button>
                </SharedEventsCompleteEvent>
              </div>
            </template>

            <!-- Adjournment history -->
            <div
              v-if="deadline.expand?.adjournments?.length > 0"
              class="flex flex-col gap-2 border-t border-border/60 pt-2"
            >
              <div
                v-for="adj in [...(deadline.expand.adjournments)].sort((a, b) => new Date(a.from) - new Date(b.from))"
                :key="adj.id"
                class="flex flex-col gap-0.5"
              >
                <div class="flex flex-row items-center gap-1.5 text-xs font-medium text-foreground">
                  <CalendarSync class="size-3 text-muted-foreground shrink-0"/>
                  <span class="text-muted-foreground">Adjourned</span>
                  <span>{{ dayjs(adj.from).format('D MMM YYYY') }}</span>
                  <ArrowRight class="size-3 text-muted-foreground shrink-0"/>
                  <span>{{ dayjs(adj.to).format('D MMM YYYY') }}</span>
                </div>
                <p v-if="adj.reason" class="text-xs text-muted-foreground pl-4">{{ adj.reason }}</p>
              </div>
            </div>

            <!-- Assignees -->
            <SharedDeadlineAssignees
              v-if="matterMembers.length > 0 && deadline.collectionName === 'Deadlines'"
              :deadline-id="deadline.id"
              :current-assignees="deadline.assignees || []"
              :matter-members="matterMembers"
              :is-supervisor="isSupervisor"
              @updated="handleAssigneesUpdated"
            />
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Loading skeleton -->
  <div v-else class="flex flex-col gap-4 animate-pulse">
    <div class="flex flex-row gap-1">
      <div v-for="i in 3" :key="i" class="h-8 w-20 bg-muted rounded-lg"></div>
    </div>
    <div class="flex flex-col">
      <div v-for="i in 5" :key="i" class="flex flex-row gap-0">
        <div class="flex flex-col items-center w-9 shrink-0">
          <div class="w-0.5 h-5 bg-muted"></div>
          <div class="size-7 bg-muted rounded-full shrink-0"></div>
          <div class="w-0.5 h-10 bg-muted"></div>
        </div>
        <div class="flex flex-col gap-1.5 flex-1 pl-2 py-2">
          <div class="h-4 bg-muted rounded w-3/5"></div>
          <div class="h-3 bg-muted rounded w-1/4"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  CalendarIcon,
  CalendarClock,
  CalendarCheck,
  ArrowRight,
  CalendarSync,
  User,
  Asterisk,
  AlertTriangle,
  Clock,
  ChevronDown,
  CheckCheck,
} from "lucide-vue-next";
import AdjournDeadline from "../../Deadline/AdjournDeadline/AdjournDeadline.vue";
import { pb } from "~/lib/pocketbase";
import { resetDeadline } from "~/services/matters";
import { toast } from "vue-sonner";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const props = defineProps(["matter", "applicationFilter"]);
const emits = defineEmits(["updated"]);

// ── Filter state ─────────────────────────────────────────────────────────────
const activeFilter = ref("active");

// ── Expand/collapse state ─────────────────────────────────────────────────────
const expandedSet = ref(new Set());

const toggleExpand = (id) => {
  const next = new Set(expandedSet.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedSet.value = next;
};

const isExpanded = (id) => expandedSet.value.has(id);

// ── All deadlines (same logic, bug fixed: '1-1-1' → safe ISO fallback) ───────
const allDeadlines = computed(() => {
  const EPOCH = "1970-01-01";
  if (props.applicationFilter === "all" || !props.applicationFilter) {
    return [
      ...(props?.matter?.expand?.deadlines || []),
      ...(props?.matter?.expand?.events?.filter((e) => e.status === "fulfilled") || []),
      ...(props?.matter?.expand?.applications?.flatMap((app) => app?.expand?.deadlines || []) || []),
    ]
      .filter((d) => d.status !== "unavailable")
      .sort((a, b) => new Date(a.date || EPOCH) - new Date(b.date || EPOCH));
  }
  return (
    props?.matter?.expand?.applications
      ?.find((ap) => ap.id === props.applicationFilter)
      ?.expand?.deadlines?.filter((d) => d.status !== "unavailable") ?? []
  );
});

// ── Filtered view ─────────────────────────────────────────────────────────────
const filteredDeadlines = computed(() => {
  if (activeFilter.value === "active") return allDeadlines.value.filter((d) => d.status !== "fulfilled");
  if (activeFilter.value === "done") return allDeadlines.value.filter((d) => d.status === "fulfilled");
  return allDeadlines.value;
});

const activeCount = computed(() => allDeadlines.value.filter((d) => d.status !== "fulfilled").length);
const doneCount = computed(() => allDeadlines.value.filter((d) => d.status === "fulfilled").length);

const filterTabs = computed(() => [
  { value: "active", label: "Active", count: activeCount.value },
  { value: "all", label: "All", count: allDeadlines.value.length },
  { value: "done", label: "Done", count: doneCount.value },
]);

// Default to "all" when all deadlines are completed
watch(
  () => props.matter,
  () => {
    if (props.matter && activeCount.value === 0 && doneCount.value > 0) {
      activeFilter.value = "all";
    }
  },
  { immediate: true }
);

// ── Urgency helpers ───────────────────────────────────────────────────────────
const urgencyOf = (deadline) => {
  if (deadline.status === "fulfilled") return "done";
  const days = dayjs(deadline.date).diff(dayjs(), "day");
  if (days < 0) return "overdue";
  if (days <= 7) return "urgent";
  return "pending";
};

const nodeClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "done") return "bg-primary text-primary-foreground";
  if (u === "overdue") return "bg-destructive/10 border-2 border-destructive text-destructive";
  if (u === "urgent") return "bg-accent-warning/10 border-2 border-accent-warning text-accent-warning";
  return "bg-muted border-2 border-border text-muted-foreground";
};

const lineClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "done") return "bg-primary/60";
  if (u === "overdue") return "bg-destructive/30";
  return "bg-border";
};

const urgencyTextClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "overdue") return "text-destructive";
  if (u === "urgent") return "text-accent-warning";
  if (u === "done") return "text-muted-foreground";
  return "text-foreground";
};

const nodeIconComponent = (deadline) => {
  if (deadline.collectionName !== "Deadlines") return Asterisk;
  if (deadline.status === "fulfilled") return CalendarCheck;
  const u = urgencyOf(deadline);
  if (u === "overdue") return AlertTriangle;
  if (u === "urgent") return Clock;
  return CalendarClock;
};

const deadlineDateDisplay = (deadline) => {
  if (deadline.status === "fulfilled") return dayjs(deadline.date).format("D MMM YYYY");
  const days = dayjs(deadline.date).diff(dayjs(), "day");
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days} days`;
  return dayjs(deadline.date).fromNow();
};

// ── Matter members ────────────────────────────────────────────────────────────
const matterMembers = computed(() => {
  if (!props.matter) return [];
  const members = [];
  const seen = new Set();
  if (props.matter.expand?.owner) {
    members.push(props.matter.expand.owner);
    seen.add(props.matter.expand.owner.id);
  }
  (props.matter.expand?.members || []).forEach((m) => {
    if (!seen.has(m.id)) {
      members.push(m);
      seen.add(m.id);
    }
  });
  return members;
});

const isSupervisor = computed(() => {
  const userId = pb.authStore.record?.id;
  if (!userId || !props.matter) return false;
  return props.matter.supervisors?.includes(userId) || false;
});

function handleAssigneesUpdated() {
  emits("updated");
}

// Kept for future use when reset is re-enabled
async function handleResetDeadline(deadline) {
  const confirmed = confirm(
    `Reset "${deadline.name}" to its template-calculated date? Dependent deadlines will also recalculate.`
  );
  if (!confirmed) return;
  try {
    const result = await resetDeadline(deadline.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Deadline reset", {
        description: `${new Date(result.oldDate).toLocaleDateString()} → ${new Date(result.newDate).toLocaleDateString()}`,
      });
      emits("updated");
    }
  } catch {
    toast.error("Failed to reset deadline");
  }
}
</script>
