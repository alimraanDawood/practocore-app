<script setup lang="ts">
/**
 * L4 — the milestone track on a litigation matter.
 *
 * A matter now carries TWO tracks. The deadline timeline above is the procedure's:
 * computed, cited, and driving the overdue/miss machinery. This is the firm's own —
 * "brief counsel", "collect the client's ID" — freely editable and owned by whoever
 * is doing it.
 *
 * Kept as a distinct section rather than interleaved into the timeline on purpose.
 * The whole justification for having both is that they are different kinds of
 * thing; merging them into one date-ordered list would erase the distinction and
 * invite a lawyer to read an internal task as a court date.
 */
import { CalendarClock, Check, Loader2, Plus, Trash2, Bell, BellOff } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import dayjs from 'dayjs'
import {
  listMatterMilestones,
  addMatterMilestone,
  updateMilestone,
  updateMilestoneStatus,
  setMilestoneReminder,
  deleteMilestone,
  type EngagementMilestone,
} from '~/services/engagements'

const props = defineProps<{ matterId: string; canEdit?: boolean }>()

const milestones = ref<EngagementMilestone[]>([])
const loading = ref(false)
const busyId = ref('')
const adding = ref(false)
const draftLabel = ref('')
const draftDue = ref('')
const draftRemind = ref(false)

const load = async () => {
  if (!props.matterId) return
  loading.value = true
  try {
    milestones.value = await listMatterMilestones(props.matterId)
  } catch (e: any) {
    // A read failure here must not take the matter page down with it.
    console.error('load matter milestones', e)
  }
  loading.value = false
}

watch(() => props.matterId, load, { immediate: true })

const pending = computed(() => milestones.value.filter(m => m.status === 'pending'))
const done = computed(() => milestones.value.filter(m => m.status !== 'pending'))

const resetDraft = () => {
  draftLabel.value = ''
  draftDue.value = ''
  draftRemind.value = false
  adding.value = false
}

const add = async () => {
  const label = draftLabel.value.trim()
  if (!label) return
  busyId.value = 'new'
  try {
    // Saving fires the shared EngagementMilestones create hook, which schedules the
    // reminder when remind is set with a future due date — the same path engagement
    // milestones take. No forked scheduling logic.
    await addMatterMilestone(props.matterId, {
      label,
      dueDate: draftDue.value || undefined,
      remind: draftRemind.value,
    })
    resetDraft()
    await load()
  } catch (e: any) {
    toast.error(e?.message || 'Could not add the milestone.')
  }
  busyId.value = ''
}

const complete = async (m: EngagementMilestone) => {
  busyId.value = m.id
  try {
    await updateMilestoneStatus(m.id, m.status === 'pending' ? 'done' : 'pending')
    await load()
  } catch (e: any) {
    toast.error(e?.message || 'Could not update the milestone.')
  }
  busyId.value = ''
}

const changeDate = async (m: EngagementMilestone, value: string) => {
  busyId.value = m.id
  try {
    // The update hook re-pins any reminder to the new date, or cancels it when the
    // date is cleared.
    await updateMilestone(m.id, { dueDate: value || undefined })
    await load()
  } catch (e: any) {
    toast.error(e?.message || 'Could not change the date.')
  }
  busyId.value = ''
}

const toggleRemind = async (m: EngagementMilestone) => {
  busyId.value = m.id
  try {
    await setMilestoneReminder(m.id, !m.remind)
    await load()
  } catch (e: any) {
    toast.error(e?.message || 'Could not change the reminder.')
  }
  busyId.value = ''
}

const remove = async (m: EngagementMilestone) => {
  busyId.value = m.id
  try {
    await deleteMilestone(m.id)
    await load()
  } catch (e: any) {
    toast.error(e?.message || 'Could not remove the milestone.')
  }
  busyId.value = ''
}

const dueLabel = (m: EngagementMilestone) =>
  m.dueDate ? dayjs(m.dueDate).format('D MMM YYYY') : 'No date'
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-row items-center justify-between gap-2">
      <div class="flex flex-col">
        <span class="text-sm font-semibold ibm-plex-serif">Milestones</span>
        <span class="text-xs text-muted-foreground">
          Your firm's own steps on this matter. Court deadlines stay on the timeline above.
        </span>
      </div>
      <Button v-if="canEdit && !adding" size="sm" variant="outline" @click="adding = true">
        <Plus class="size-3.5" />
        Add milestone
      </Button>
    </div>

    <!-- Draft row -->
    <div v-if="adding" class="flex flex-col gap-2 rounded-lg border border-border p-3">
      <Input v-model="draftLabel" placeholder="e.g. Brief counsel on the WSD" @keyup.enter="add" />
      <div class="flex flex-row items-center gap-2 flex-wrap">
        <Input v-model="draftDue" type="date" class="w-auto" />
        <Button
          size="sm"
          :variant="draftRemind ? 'default' : 'outline'"
          @click="draftRemind = !draftRemind"
        >
          <Bell class="size-3.5" />
          {{ draftRemind ? 'Reminder on' : 'Remind me' }}
        </Button>
        <div class="flex-1"></div>
        <Button size="sm" variant="ghost" @click="resetDraft">Cancel</Button>
        <Button size="sm" :disabled="!draftLabel.trim() || busyId === 'new'" @click="add">
          <Loader2 v-if="busyId === 'new'" class="size-3.5 animate-spin" />
          Add
        </Button>
      </div>
      <p v-if="draftRemind && !draftDue" class="text-xs text-muted-foreground">
        A reminder needs a future due date to fire.
      </p>
    </div>

    <div v-if="loading" class="grid place-items-center py-6">
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
    </div>

    <p v-else-if="milestones.length === 0 && !adding" class="text-sm italic text-muted-foreground ibm-plex-serif">
      No milestones yet. Add the steps your firm tracks itself alongside the court's dates.
    </p>

    <div v-else class="flex flex-col divide-y divide-border/60">
      <div
        v-for="m in [...pending, ...done]"
        :key="m.id"
        class="flex flex-row items-center gap-2 py-2"
      >
        <button
          type="button"
          class="size-5 shrink-0 rounded-full border grid place-items-center transition-colors"
          :class="m.status === 'pending'
            ? 'border-border hover:border-primary text-transparent hover:text-primary'
            : 'border-primary bg-primary text-primary-foreground'"
          :disabled="!canEdit || busyId === m.id"
          :aria-label="m.status === 'pending' ? 'Mark done' : 'Reopen'"
          @click="complete(m)"
        >
          <Loader2 v-if="busyId === m.id" class="size-3 animate-spin" />
          <Check v-else class="size-3" />
        </button>

        <div class="flex flex-col min-w-0 flex-1">
          <span
            class="text-sm truncate"
            :class="m.status === 'pending' ? 'text-foreground' : 'text-muted-foreground line-through'"
          >{{ m.label }}</span>
          <span class="text-[11px] text-muted-foreground flex flex-row items-center gap-1">
            <CalendarClock class="size-2.5 shrink-0" />
            {{ dueLabel(m) }}
          </span>
        </div>

        <template v-if="canEdit">
          <Input
            type="date"
            class="w-auto h-8 text-xs"
            :model-value="m.dueDate ? m.dueDate.slice(0, 10) : ''"
            :disabled="busyId === m.id"
            @update:model-value="(v) => changeDate(m, String(v ?? ''))"
          />
          <Button
            size="icon"
            variant="ghost"
            class="size-8 shrink-0"
            :disabled="busyId === m.id"
            :aria-label="m.remind ? 'Turn reminder off' : 'Turn reminder on'"
            @click="toggleRemind(m)"
          >
            <Bell v-if="m.remind" class="size-3.5 text-primary" />
            <BellOff v-else class="size-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="size-8 shrink-0"
            :disabled="busyId === m.id"
            aria-label="Remove milestone"
            @click="remove(m)"
          >
            <Trash2 class="size-3.5 text-muted-foreground" />
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>
