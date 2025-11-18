<template>
    <div v-if="matter !== null" class="flex flex-col">
        <div
            v-for="deadline, index in matter?.expand?.deadlines?.sort((d1, d2) => { return new Date(d1.date) - new Date(d2.date); })"
            :key="deadline.id" class="flex flex-row text-left hover:bg-muted/30 group">
            <div class="flex flex-col px-2 items-center">
                <div class="w-1 h-5 bg-muted group-first:opacity-0" :class="{ 'bg-primary': deadline.completed }"></div>
                <div class="size-8 bg-muted shrink-0 rounded-full grid place-items-center"
                    :class="{ 'bg-primary text-primary-foreground border-0': deadline.completed }">
                    <CalendarCheck v-if="deadline.completed" class="size-4" />
                    <CalendarClock v-else class="size-4" />
                </div>
                <div class="w-1 h-full bg-muted group-last:opacity-0" :class="{ 'bg-primary': deadline.completed }">
                </div>
            </div>

            <div class="flex flex-col text-left  w-full p-2 pb-8 gap-2">
                <div class="flex flex-row items-center justify-between gap-2">
                    <button @click="$emit('deadlineSelected', deadline.id)" class="text-left w-fit font-semibold ibm-plex-serif underline hover:text-primary">{{ deadline.name }}</button>
                </div>

                <template v-if="!deadline.completed">
                    <div class="flex flex-col lg:flex-row gap-2 lg:items-center">
                        <span class="text-sm text-muted-foreground">{{ deadline.input_prompt }}</span>

                        <div @click="e => e.stopPropagation()" class="flex flex-row items-center gap-2">
                            <SharedDeadlineCompleteDeadline @updated="emits('updated')" :deadline="deadline">
                                <button @click="e => e.stopPropagation()"
                                    class="border bg-muted px-2 p-1 flex flex-row items-center gap-1 text-xs w-fit">
                                    <CalendarIcon class="size-3" />

                                    Set Date
                                </button>
                            </SharedDeadlineCompleteDeadline>

                            <AdjournDeadline @updated="emits('updated')" :deadline="deadline">
                                <button
                                    class="rounded bg-secondary text-secondary-foreground px-2 p-1 flex flex-row items-center gap-1 text-xs font-semibold w-fit">
                                    Adjourn Deadline
                                </button>
                            </AdjournDeadline>
                        </div>
                    </div>

                    <span class="text-sm italic text-muted-foreground ibm-plex-serif"
                        v-html="deadline.pending_prompt.replace('<<date>>', `<b class='text-foreground'>${dayjs(deadline.date, { timezone: getSignedInUser()?.timezone }).format('D MMM YYYY')}</b>`).replace('<<from_now>>', `<b class='text-foreground'>${dayjs(deadline.date, { timezone: getSignedInUser()?.timezone }).fromNow()}</b>`)"></span>

                </template>

                <div v-else class="flex flex-row flex-wrap gap-2">
                    <span class="text-sm italic text-muted-foreground ibm-plex-serif"
                        v-html="deadline.fulfilled_prompt.replace('<<date>>', ``)"></span>

                    <SharedDeadlineCompleteDeadline :deadline="deadline">
                        <button @click="e => e.stopPropagation()"
                            class="border bg-muted px-2 py-1 inline-flex items-center gap-1 text-xs align-baseline">
                            <CalendarIcon class="size-3" />
                            {{ dayjs(deadline.date, { timezone: getSignedInUser()?.timezone  }).format('D MMM YYYY') }}
                        </button>
                    </SharedDeadlineCompleteDeadline>
                </div>

                <div class="flex flex-col gap-2 mt-5">
                    <div v-for="adjournment in deadline?.expand?.adjournments?.sort((a1, a2) => { return new Date(a1.from) - new Date(a2.from) })" class="flex flex-col gap-1 text-xs">
                        <div class="flex flex-row font-semibold ibm-plex-serif gap-2 items-center">
                            <div class="flex flex-row items-center gap-1">
                                <CalendarSync class="size-4" />
                                <span>Adjournment</span>
                            </div>

                            <span>{{ dayjs(adjournment.from, { timezone: getSignedInUser()?.timezone  }).format("D MMM YYYY") }}</span>
                            <ArrowRight class="size-3" />
                            <span>{{ dayjs(adjournment.to, { timezone: getSignedInUser()?.timezone  }).format("D MMM YYYY") }}</span>
                        </div>
                        <span class="text-muted-foreground">{{ adjournment.reason }}</span>
                    </div>
                </div>

              <SharedDeadlineAssignees
                  @click="e => e.stopPropagation()"
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
    <div v-else class="flex flex-col w-full">
        <div v-for="i in 5" class="flex flex-row text-left hover:bg-muted/30 group animate-pulse">
            <div class="flex flex-col px-2 items-center">
                <div class="w-1 h-5 bg-muted group-first:opacity-0"></div>
                
                <div class="size-8 bg-muted shrink-0 rounded-full grid place-items-center">
                </div>

                <div class="w-1 h-full bg-muted group-last:opacity-0">
                </div>
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
import { computed } from 'vue';
import { Check, Circle, Dot, CalendarIcon, CalendarClock, CalendarCheck, ArrowRight, CalendarSync } from "lucide-vue-next"
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime"
import AdjournDeadline from "../../Deadline/AdjournDeadline/AdjournDeadline.vue";
import { getSignedInUser } from "~/services/auth";
import { pb } from '~/lib/pocketbase';

dayjs.extend(relativeTime);

const props = defineProps(['matter']);
const emits = defineEmits(['updated', 'deadlineSelected']);

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
        props.matter.expand.members.forEach(member => {
            if (!memberIds.has(member.id)) {
                members.push(member);
                memberIds.add(member.id);
            }
        });
    }

    return members;
});

// Check if current user is a supervisor
const isSupervisor = computed(() => {
    const userId = pb.authStore.record?.id;
    if (!userId || !props.matter) return false;
    return props.matter.supervisors?.includes(userId) || false;
});

// Handle assignee updates
function handleAssigneesUpdated() {
    emits('updated');
}
</script>