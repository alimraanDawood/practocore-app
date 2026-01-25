<template>
  <div v-if="matter !== null" class="flex flex-col">
    <div class="flex flex-col">
      <!-- Trigger Date Node at the start -->
      <div class="flex flex-row text-left group">
        <div class="flex flex-col px-2 items-center">
          <div
              class="size-8 bg-primary/20 shrink-0 rounded-full grid place-items-center border-2 border-primary"
          >
            <CalendarIcon class="size-4 text-primary"/>
          </div>
          <div class="w-1 h-full bg-primary"></div>
        </div>

        <div class="flex flex-col w-full p-2 pb-8 gap-2">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <div class="flex flex-col lg:flex-row lg:items-center gap-2">
              <span class="font-semibold ibm-plex-serif">{{ matter?.triggerDateName || 'Trigger Date' }}</span>
              <span class="text-sm text-muted-foreground">
                {{
                  dayjs(matter.triggerDate, {
                    timezone: getSignedInUser()?.timezone,
                  }).format("D MMM YYYY")
                }}
              </span>
            </div>

            <SharedMattersChangeTriggerDate v-if="isSupervisor && false" :matter="matter" @updated="emits('updated')">
              <button class="rounded bg-primary/10 text-primary px-2 p-1 flex flex-row items-center gap-1 text-xs font-semibold w-fit hover:bg-primary/20 transition-colors">
                <CalendarIcon class="size-3"/>
                Change Date
              </button>
            </SharedMattersChangeTriggerDate>
          </div>
        </div>
      </div>

      <div v-for="(deadline, index) in deadlines" :key="deadline.id" class="flex flex-row text-left hover:bg-muted/30 group">
        <div class="flex flex-col px-2 items-center">
          <div class="w-1 h-5 bg-muted group-first:opacity-0" :class="{ 'bg-primary': deadline.status === 'fulfilled' }"></div>
          <div class="size-8 bg-muted shrink-0 rounded-full grid place-items-center" :class="{'bg-primary text-primary-foreground border-0': deadline.status === 'fulfilled'}">
            <CalendarCheck v-if="deadline.status === 'fulfilled'" class="size-4"/>
            <CalendarClock v-else class="size-4"/>
          </div>
          <div
              class="w-1 h-full bg-muted group-last:opacity-0"
              :class="{ 'bg-primary': deadline.status === 'fulfilled' }"
          ></div>
        </div>

        <div class="flex flex-col text-left w-full p-2 pb-8 gap-2">
          <div class="flex flex-row items-center justify-between gap-2">
            <div class="flex flex-col gap-1 flex-1">
              <div v-if="deadline?.application" class="flex flex-row gap-2">
                <Badge variant="outline">Application</Badge>

                <Badge variant="secondary">{{ matter?.expand?.applications?.find(a => a.id === deadline?.application)?.type }}</Badge>
              </div>

              <button
                  @click="$emit('deadlineSelected', deadline.id)"
                  class="text-left w-fit font-semibold ibm-plex-serif underline hover:text-primary"
              >
                {{ deadline.name }}
              </button>
              <!-- Party Context Badge (if party-specific deadline) -->
              <div v-if="deadline.party_context" class="flex items-center gap-1">
                <Badge variant="outline" class="text-xs gap-1">
                  <User class="size-3"/>
                  {{ deadline.party_context.party_name }}
                </Badge>
                <Badge variant="secondary" class="text-xs">
                  {{ formatPartyType(deadline.party_context.party_type) }}
                </Badge>
              </div>
            </div>
          </div>

          <template v-if="!(deadline.status === 'fulfilled')">
            <span
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="
                deadline.pending_prompt
                  .replace(
                    '<<date>>',
                    `<b class='text-foreground'>${dayjs(deadline.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).format('D MMM YYYY')}</b>`
                  )
                  .replace(
                    '<<from_now>>',
                    `<b class='text-foreground'>${dayjs(deadline.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).fromNow()}</b>`
                  )
              "
            ></span>

            <div class="flex flex-col lg:flex-row gap-2 lg:items-center">
              <span class="text-sm text-muted-foreground">{{
                  deadline.input_prompt
                }}</span>

              <div class="flex flex-row items-center gap-2 flex-wrap">
                <SharedDeadlineCompleteDeadline
                    @updated="emits('updated')"
                    :deadline="deadline"
                >
                  <button
                      class="border bg-muted px-2 p-1 flex flex-row items-center gap-1 text-xs w-fit"
                  >
                    <CalendarIcon class="size-3"/>
                    Set Date
                  </button>
                </SharedDeadlineCompleteDeadline>

                <AdjournDeadline @updated="emits('updated')" :deadline="deadline">
                  <button
                      class="rounded bg-secondary text-secondary-foreground px-2 p-1 flex flex-row items-center gap-1 text-xs font-semibold w-fit"
                  >
                    Adjourn Deadline
                  </button>
                </AdjournDeadline>
              </div>
            </div>
          </template>

          <div v-else class="flex flex-row flex-wrap gap-2">
            <span
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="deadline.fulfilled_prompt.replace('<<date>>', ``)"
            ></span>

            <SharedDeadlineCompleteDeadline
                @updated="emits('updated')"
                :deadline="deadline"
            >
              <button
                  @click="(e) => e.stopPropagation()"
                  class="border bg-muted px-2 py-1 inline-flex items-center gap-1 text-xs align-baseline"
              >
                <CalendarIcon class="size-3"/>
                {{
                  dayjs(deadline.date, {utc: true}).format("D MMM YYYY")
                }}
              </button>
            </SharedDeadlineCompleteDeadline>

            <button
                v-if="isSupervisor && false"
                @click="handleResetDeadline(deadline)"
                class="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 p-1 flex flex-row items-center gap-1 text-xs font-semibold w-fit hover:bg-amber-500/20 transition-colors"
            >
              <RotateCcw class="size-3"/>
              Reset
            </button>
          </div>

          <div class="flex flex-col gap-2 mt-5">
            <div
                v-for="adjournment in deadline?.expand?.adjournments?.sort(
                (a1, a2) => {
                  return new Date(a1.from) - new Date(a2.from);
                }
              )"
                class="flex flex-col gap-1 text-xs"
            >
              <div
                  class="flex flex-row font-semibold ibm-plex-serif gap-2 items-center"
              >
                <div class="flex flex-row items-center gap-1">
                  <CalendarSync class="size-4"/>
                  <span>Adjournment</span>
                </div>

                <span>{{
                    dayjs(adjournment.from, {
                      timezone: getSignedInUser()?.timezone,
                    }).format("D MMM YYYY")
                  }}</span>
                <ArrowRight class="size-3"/>
                <span>{{
                    dayjs(adjournment.to, {
                      timezone: getSignedInUser()?.timezone,
                    }).format("D MMM YYYY")
                  }}</span>
              </div>
              <span class="text-muted-foreground">{{ adjournment.reason }}</span>
            </div>
          </div>

          <SharedDeadlineAssignees
              @click="(e) => e.stopPropagation()"
              v-if="matterMembers.length > 0"
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

  <div v-else class="flex flex-col w-full">
    <div
        v-for="i in 5"
        class="flex flex-row text-left hover:bg-muted/30 group animate-pulse"
    >
      <div class="flex flex-col px-2 items-center">
        <div class="w-1 h-5 bg-muted group-first:opacity-0"></div>

        <div
            class="size-8 bg-muted shrink-0 rounded-full grid place-items-center"
        ></div>

        <div class="w-1 h-full bg-muted group-last:opacity-0"></div>
      </div>
      <div class="flex flex-col gap-2 w-full">
        <div class="bg-muted w-full h-5 rounded"></div>

        <div class="bg-muted w-full h-10 rounded"></div>

        <div class="flex flex-row gap-3">
          <div class="bg-muted w-24 h-5 rounded"></div>
          <div class="bg-muted w-24 h-5 rounded"></div>
        </div>

        <div class="bg-muted w-full h-10 rounded"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed} from "vue";
import {
  Check,
  Circle,
  Dot,
  CalendarIcon,
  CalendarClock,
  CalendarCheck,
  ArrowRight,
  CalendarSync,
  RotateCcw,
  User,
  Plus
} from "lucide-vue-next";
import {Badge} from "@/components/ui/badge";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import AdjournDeadline from "../../Deadline/AdjournDeadline/AdjournDeadline.vue";
import {getSignedInUser} from "~/services/auth";
import {pb} from "~/lib/pocketbase";
import {resetDeadline} from "~/services/matters";
import {toast} from "vue-sonner";

dayjs.extend(relativeTime);

import { DeadlineEngine } from "~/lib/deadline-engine/index.ts";

const props = defineProps(["matter", "applicationFilter"]);
const emits = defineEmits(["updated", "deadlineSelected"]);

// Format party type for display
const formatPartyType = (type) => {
  const typeMap = {
    individual: "Individual",
    corporate: "Corporate",
    government: "Government",
    other: "Other",
  };

  return typeMap[type] || type;
};

// Get all matter members (owner + members array)
const matterMembers = computed(() => {
  if (!props.matter) return [];

  const members = [];
  const memberIds = new Set();

  // Add owner
  if (props.matter.expand?.owner) {
    members.push(props.matter.expand.owner);
    memberIds.add(props.matter.expand.owner.id);
  }

  // Add explicit members
  if (props.matter.expand?.members) {
    props.matter.expand.members.forEach((member) => {
      if (!memberIds.has(member.id)) {
        members.push(member);
        memberIds.add(member.id);
      }
    });
  }

  return members;
});

const deadlines = computed(() => {
  // const baseList = matter?.expand?.deadlines?.sort((d1, d2) => { return new Date(d1.date) - new Date(d2.date); })
  if(props.applicationFilter === "all" || !props.applicationFilter) {
    return ([...(props?.matter?.expand?.deadlines || []), ...(props?.matter?.expand?.applications?.flatMap(application => application?.expand?.deadlines) || [])]).sort((d1, d2) => { return new Date(d1.date) - new Date(d2.date); });
  }

  return props?.matter?.expand?.applications.find(ap => ap.id === props?.applicationFilter)?.expand?.deadlines || [];
});

// Check if current user is a supervisor
const isSupervisor = computed(() => {
  const userId = pb.authStore.record?.id;

  if (!userId || !props.matter) return false;

  return props.matter.supervisors?.includes(userId) || false;
});

// Handle assignee updates
function handleAssigneesUpdated() {
  emits("updated");
}

// Handle deadline reset
async function handleResetDeadline(deadline) {
  const confirmed = confirm(
      `Are you sure you want to reset "${deadline.name}" to its template-calculated date? This will also recalculate any dependent deadlines.`
  );

  if (!confirmed) return;

  try {
    const result = await resetDeadline(deadline.id);

    if (result.error) {
      toast.error(result.error);
    } else {
      const oldDate = new Date(result.oldDate).toLocaleDateString();
      const newDate = new Date(result.newDate).toLocaleDateString();

      toast.success("Deadline reset successfully!", {
        description: `Changed from ${oldDate} to ${newDate}`,
      });
      emits("updated");
    }
  } catch (error) {
    console.error("Error resetting deadline:", error);
    toast.error("Failed to reset deadline");
  }
}
</script>
