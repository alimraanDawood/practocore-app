<template>
  <!-- Loaded state -->
  <div v-if="matter !== null" class="flex flex-col gap-4">

    <!-- Unassigned deadlines alert (supervisors only) -->
    <div
      v-if="isSupervisor && unassignedDeadlines.length > 0"
      class="flex flex-row items-start gap-2.5 rounded-lg border border-accent-warning/30 bg-accent-warning/5 p-3"
    >
      <UserX class="size-4 text-accent-warning shrink-0 mt-0.5"/>
      <div class="flex flex-col gap-0.5 min-w-0 flex-1">
        <span class="text-sm font-semibold ibm-plex-serif leading-snug">
          {{ unassignedDeadlines.length }} deadline{{ unassignedDeadlines.length !== 1 ? 's' : '' }}
          need{{ unassignedDeadlines.length === 1 ? 's' : '' }} an assignee
        </span>
        <span class="text-xs text-muted-foreground">
          Only assigned team members receive reminders. Assign someone so
          {{ unassignedDeadlines.length === 1 ? "it isn't" : "they aren't" }} missed.
        </span>
      </div>
      <Button size="sm" variant="outline" class="shrink-0" @click="reviewUnassigned">
        Review
      </Button>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-row gap-1 items-center">
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

      <!-- Add a deadline the firm tracks itself, alongside the court's own dates. -->
      <Button
        v-if="canAddDeadline"
        size="sm"
        variant="outline"
        class="ml-auto shrink-0"
        @click="openAddDeadline"
      >
        <CalendarPlus class="size-3.5"/>
        Add deadline
      </Button>
    </div>

    <AdhocDeadlineDialog
      v-if="canAddDeadline"
      v-model:open="adhocDialogOpen"
      :matter-id="matter.id"
      :deadline="adhocEditing"
      @saved="emits('updated')"
    />

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
          <div class="flex flex-row items-center gap-2">
            <span class="text-xs text-muted-foreground">
              {{ dayjs(matter.triggerDate).format('D MMM YYYY') }}
            </span>
            <!-- Every date on this timeline is computed from this one, so it has to
                 be correctable. Provisional matters are excluded: their banner owns
                 the date through "Confirm trigger date", which also switches
                 reminders on. Supervisor-gated to match the server rule. -->
            <SharedMattersChangeTriggerDate
              v-if="canChangeTriggerDate"
              :matter="matter"
              @updated="emits('updated')"
            >
              <span class="text-xs text-primary hover:underline">Change</span>
            </SharedMattersChangeTriggerDate>
          </div>
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

              <!-- L6: the other side's step. Shown because a litigator has to plan
                   against it, marked because it is not this firm's work — no
                   countdown, no urgency colour, no reminder. -->
              <div v-if="isOtherSide(deadline)" class="flex flex-row items-center gap-1 mb-0.5">
                <Users class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {{ otherSideRoleLabel(deadline) || 'Other party' }}'s step
                </span>
              </div>

              <!-- Firm-added marker: never let a firm's own note read as a court date -->
              <div v-if="isAdhoc(deadline)" class="flex flex-row items-center gap-1 mb-0.5">
                <CalendarPlus class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Added by your firm
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

              <!-- Unassigned highlight (supervisors only) -->
              <div v-if="isSupervisor && isUnassigned(deadline)" class="flex flex-row items-center gap-1 mt-0.5">
                <UserX class="size-2.5 text-accent-warning shrink-0"/>
                <span class="text-[10px] font-medium text-accent-warning">Unassigned</span>
              </div>
            </div>

            <!-- Date / urgency -->
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="text-xs font-semibold tabular-nums" :class="urgencyTextClass(deadline)">
                {{ deadlineDateDisplay(deadline) }}
              </span>
              <span v-if="deadline.date" class="text-[10px] text-muted-foreground">{{ dayjs(deadline.date).format('D MMM') }}</span>
            </div>

            <ChevronDown
              class="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-150"
              :class="isExpanded(deadline.id) ? 'rotate-180' : ''"
            />
          </button>

          <!-- Expanded detail -->
          <div v-if="isExpanded(deadline.id)" class="flex flex-col gap-3 pb-5 pt-1 pr-1">

            <!-- Firm-added (ad-hoc) deadline. Handled before the court branches
                 because it is not an engine node: it has no prompts to render and
                 must never be routed through fulfill/adjourn, which target the
                 matter's event log. -->
            <template v-if="isAdhoc(deadline)">
              <p v-if="deadline.description" class="text-sm text-muted-foreground">
                {{ deadline.description }}
              </p>
              <p v-else class="text-sm italic text-muted-foreground ibm-plex-serif">
                A deadline your firm is tracking on this matter.
              </p>

              <div class="flex flex-row gap-2 flex-wrap">
                <Button
                  v-if="deadline.status !== 'fulfilled'"
                  size="sm"
                  :disabled="adhocBusy === deadline.id"
                  @click="completeAdhoc(deadline)"
                >
                  <CheckCheck class="size-3"/>
                  Mark done
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="adhocBusy === deadline.id"
                  @click="completeAdhoc(deadline, true)"
                >
                  Reopen
                </Button>

                <Button size="sm" variant="outline" @click="openEditDeadline(deadline)">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-destructive hover:text-destructive"
                  :disabled="adhocBusy === deadline.id"
                  @click="removeAdhoc(deadline)"
                >
                  Delete
                </Button>
              </div>
            </template>

            <!-- Fulfilled deadline -->
            <template v-else-if="deadline.status === 'fulfilled'">
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
  CalendarPlus,
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
  UserX,
  Users,
} from "lucide-vue-next";
import AdjournDeadline from "../../Deadline/AdjournDeadline/AdjournDeadline.vue";
import AdhocDeadlineDialog from "../../Deadline/AdhocDeadline/AdhocDeadlineDialog.vue";
import { pb } from "~/lib/pocketbase";
import { resetDeadline, completeAdhocDeadline, deleteAdhocDeadline } from "~/services/matters";
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

// ── Unassigned deadlines (supervisor concern) ─────────────────────────────────
// ── L6: whose obligation is this? ─────────────────────────────────────────────
// The engine generates the WHOLE two-sided timeline, because the other side's
// steps are real dates a litigator has to plan against — a plaintiff needs to know
// when the defence falls due. But they are not the firm's own work, and rendering
// them in the firm's alarm colours would put a red "overdue" on a step nobody in
// the office was ever going to do.
//
// The comparison is done here, at read time, rather than in the engine: the firm
// can change who it acts for, and that must never require rebuilding a schedule.
// A deadline with no role (the mediation and scheduling steps, which bind both
// sides) is always ours.
const representedRoleId = computed(() => {
  const r = props.matter?.representing;
  if (!r) return "";
  return r.role_id ?? r.roleId ?? "";
});

const isOtherSide = (deadline) => {
  const role = deadline?.role;
  if (!role) return false;
  // Until the firm says who it acts for, claim nothing — showing every step as
  // the other side's would empty the timeline.
  if (!representedRoleId.value) return false;
  return role !== representedRoleId.value;
};

const otherSideRoleLabel = (deadline) => {
  const roles = normalizePartyConfig(props.matter?.partyConfig)?.roles ?? [];
  return roles.find((r) => r.id === deadline?.role)?.name ?? "";
};

// A deadline needs an assignee when it's an actionable (non-fulfilled) Deadline
// record with no one assigned — only assignees receive reminders for it.
// The other side's steps are excluded: nobody in this firm is going to do them,
// so flagging them to a supervisor as "needs an assignee" is a false alarm that
// would grow with every two-sided matter.
const isUnassigned = (deadline) =>
  deadline.collectionName === "Deadlines" &&
  deadline.status !== "fulfilled" &&
  !isOtherSide(deadline) &&
  (deadline.assignees?.length ?? 0) === 0;

const unassignedDeadlines = computed(() => allDeadlines.value.filter(isUnassigned));

// Banner CTA: surface every unassigned deadline so a supervisor can act on them.
const reviewUnassigned = () => {
  activeFilter.value = "active";
  const next = new Set(expandedSet.value);
  for (const d of unassignedDeadlines.value) next.add(d.id);
  expandedSet.value = next;
};

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
// A deadline is "projected" when its matter's trigger date is still provisional
// (an estimate). Projected deadlines are a planning view: even if their computed
// date is in the past, they must NOT render as overdue/urgent, and no reminders
// exist for them yet. The owning matter is the parent when deadline.application is
// unset, otherwise the child application identified by deadline.application.
// A firm-added deadline (origin 'adhoc') is an ordinary Deadlines row with no
// t_id — see the ad-hoc block below and internal/deadlinev2/adhoc.go. Declared
// here because isProjected/urgencyOf depend on it.
const isAdhoc = (deadline) => deadline?.origin === "adhoc";

const isProjected = (deadline) => {
  // A firm-added deadline is a date the lawyer entered themselves, not one
  // computed off an estimated trigger date — so it is never "projected", even on
  // a provisional matter. This matches the backend, which materialises its
  // reminders regardless of triggerStatus.
  if (isAdhoc(deadline)) return false;
  if (deadline?.application) {
    const app = props.matter?.expand?.applications?.find((a) => a.id === deadline.application);
    return app?.triggerStatus === "provisional";
  }
  return props.matter?.triggerStatus === "provisional";
};

const urgencyOf = (deadline) => {
  if (deadline.status === "fulfilled") return "done";
  // Checked before the date arithmetic: the other side's step is context, so it
  // must never render as this firm's overdue or urgent work.
  if (isOtherSide(deadline)) return "theirs";
  if (isProjected(deadline)) return "projected";
  if (!deadline.date) return "pending"; // undated ad-hoc task

  const days = dayjs(deadline.date).diff(dayjs(), "day");
  if (days < 0) return "overdue";
  if (days <= 7) return "urgent";
  return "pending";
};

const nodeClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "done") return "bg-primary text-primary-foreground";
  if (u === "theirs") return "bg-transparent border-2 border-dotted border-border text-muted-foreground";
  if (u === "projected") return "bg-muted border-2 border-dashed border-border text-muted-foreground";
  if (u === "overdue") return "bg-destructive/10 border-2 border-destructive text-destructive";
  if (u === "urgent") return "bg-accent-warning/10 border-2 border-accent-warning text-accent-warning";
  return "bg-muted border-2 border-border text-muted-foreground";
};

const lineClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "done") return "bg-primary/60";
  if (u === "theirs") return "bg-border/50";
  if (u === "overdue") return "bg-destructive/30";
  return "bg-border";
};

const urgencyTextClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "theirs") return "text-muted-foreground";
  if (u === "projected") return "text-muted-foreground";
  if (u === "overdue") return "text-destructive";
  if (u === "urgent") return "text-accent-warning";
  if (u === "done") return "text-muted-foreground";
  return "text-foreground";
};

const nodeIconComponent = (deadline) => {
  if (deadline.collectionName !== "Deadlines") return Asterisk;
  if (deadline.status === "fulfilled") return CalendarCheck;
  const u = urgencyOf(deadline);
  if (u === "theirs") return CalendarClock;
  if (u === "projected") return CalendarClock;
  if (u === "overdue") return AlertTriangle;
  if (u === "urgent") return Clock;
  return CalendarClock;
};

const deadlineDateDisplay = (deadline) => {
  // Ad-hoc deadlines may legitimately carry no date (a task not yet scheduled).
  // Every other branch here does date arithmetic, so bail out first.
  if (!deadline.date) return "No date";
  if (deadline.status === "fulfilled") return dayjs(deadline.date).format("D MMM YYYY");
  // The other side's step is a plain date, not a countdown. "3 days" reads as an
  // instruction to this firm; it is not one.
  if (isOtherSide(deadline)) return dayjs(deadline.date).format("D MMM YYYY");
  if (isProjected(deadline)) return deadline.date ? `Projected · ${dayjs(deadline.date).format("D MMM YYYY")}` : "Projected";
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

// ── Ad-hoc deadlines ──────────────────────────────────────────────────────────
// Rows the firm added itself (origin: 'adhoc'). They are ordinary Deadlines rows
// with no t_id, so they arrive in the same expand.deadlines payload and need no
// separate fetch — but they are NOT engine nodes, so fulfil/adjourn do not apply
// to them and the backend refuses those verbs.

const adhocDialogOpen = ref(false);
const adhocEditing = ref(null);
const adhocBusy = ref(null);

// Anyone working the matter may add to it — matching the API, which allows the
// owner, supervisors, and members (mutating an existing row is narrower: the
// backend requires a supervisor or an assignee on that row).
const canAddDeadline = computed(() => {
  const userId = pb.authStore.record?.id;
  if (!userId || !props.matter) return false;
  return (
    props.matter.owner === userId ||
    props.matter.supervisors?.includes(userId) ||
    props.matter.members?.includes(userId) ||
    false
  );
});

// Changing the trigger date recomputes the entire timeline, so the server limits
// it to supervisors — mirrored here so nobody is offered a control that 403s.
// While the matter is provisional the banner's "Confirm trigger date" owns this
// date instead (it also flips reminders on), so we stay out of its way.
const canChangeTriggerDate = computed(() => {
  const userId = pb.authStore.record?.id;
  if (!userId || !props.matter) return false;
  if (props.matter.triggerStatus === 'provisional') return false;
  return props.matter.supervisors?.includes(userId) ?? false;
});

function openAddDeadline() {
  adhocEditing.value = null;
  adhocDialogOpen.value = true;
}

function openEditDeadline(deadline) {
  adhocEditing.value = deadline;
  adhocDialogOpen.value = true;
}

async function completeAdhoc(deadline, undo = false) {
  adhocBusy.value = deadline.id;
  try {
    const res = await completeAdhocDeadline(deadline.id, undo);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(undo ? "Deadline reopened" : "Deadline marked done");
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not update deadline");
  } finally {
    adhocBusy.value = null;
  }
}

async function removeAdhoc(deadline) {
  const confirmed = confirm(
    `Delete "${deadline.name}"? This removes it and its reminders. Court deadlines are unaffected.`
  );
  if (!confirmed) return;

  adhocBusy.value = deadline.id;
  try {
    const res = await deleteAdhocDeadline(deadline.id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Deadline deleted");
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not delete deadline");
  } finally {
    adhocBusy.value = null;
  }
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
