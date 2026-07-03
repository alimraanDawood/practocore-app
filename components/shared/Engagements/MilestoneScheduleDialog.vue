<script setup lang="ts">
import { CalendarClock, Plus, X, Bell, Loader2, Sparkles } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  createMilestone, scheduleMilestone,
  type EngagementMilestone, type MilestonePlan, type TemplateStage,
} from '~/services/engagements';

const props = withDefaults(defineProps<{
  open: boolean;
  engagementId: string;
  /** Editing an existing milestone; omit to add a new one. */
  milestone?: EngagementMilestone | null;
  /** Stages of the engagement, so a new milestone can be filed under one. */
  stages?: TemplateStage[];
}>(), { milestone: null, stages: () => [] });

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved', milestone: EngagementMilestone): void;
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const isEdit = computed(() => !!props.milestone);

// ── Form state ──────────────────────────────────────────────────────────────
const label = ref('');
const stageId = ref<string>('none');
const date = ref('');
const remind = ref(true);
const mode = ref<'single' | 'series'>('single');
// Lead times (days before the due date) for incremental reminders. The on-the-day
// touchpoint is controlled separately so a series always lands on the date too.
const offsets = ref<number[]>([7, 1]);
const remindOnDay = ref(true);
const channels = reactive({ APP: true, EMAIL: true, PUSH: true });

const submitting = ref(false);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// reka-ui Select forbids empty-string item values, so "none" is the sentinel for
// "no stage" (a ceremony-free engagement).
function resetForm() {
  const m = props.milestone;
  label.value = m?.label ?? '';
  stageId.value = m?.stageId || 'none';
  date.value = m?.dueDate ? m.dueDate.slice(0, 10) : '';
  remind.value = m ? m.remind : true;

  const savedOffsets = (m?.reminderOffsets ?? []).filter((n) => n > 0);
  const savedOnDay = (m?.reminderOffsets ?? []).includes(0);
  if (m && (savedOffsets.length > 0 || m.reminderOffsets)) {
    // Reconstruct the saved plan.
    mode.value = savedOffsets.length > 0 ? 'series' : 'single';
    offsets.value = savedOffsets.length > 0 ? savedOffsets : [7, 1];
    remindOnDay.value = savedOffsets.length > 0 ? savedOnDay : true;
  } else {
    mode.value = 'single';
    offsets.value = [7, 1];
    remindOnDay.value = true;
  }

  const ch = m?.reminderChannels;
  channels.APP = ch ? ch.includes('APP') : true;
  channels.EMAIL = ch ? ch.includes('EMAIL') : true;
  channels.PUSH = ch ? ch.includes('PUSH') : true;
}

watch(isOpen, (open) => { if (open) resetForm(); });

function addOffset() {
  offsets.value.push(3);
}
function removeOffset(i: number) {
  offsets.value.splice(i, 1);
}

const selectedChannels = computed(() =>
  (Object.keys(channels) as Array<keyof typeof channels>).filter((c) => channels[c]) as Array<'APP' | 'EMAIL' | 'PUSH'>
);

const canSubmit = computed(() =>
  label.value.trim().length > 0 &&
  // A reminder needs a date to fire; without one we still allow saving (date-less
  // milestone), but not with remind on.
  (!remind.value || !!date.value) &&
  (!remind.value || selectedChannels.value.length > 0)
);

function buildPlan(): MilestonePlan {
  let payloadOffsets: number[] | undefined;
  if (remind.value) {
    if (mode.value === 'single') {
      payloadOffsets = [0];
    } else {
      payloadOffsets = [...offsets.value.filter((n) => Number.isFinite(n) && n > 0)];
      if (remindOnDay.value) payloadOffsets.push(0);
      if (payloadOffsets.length === 0) payloadOffsets = [0];
    }
  }
  return {
    label: label.value.trim(),
    stageId: stageId.value === 'none' ? '' : stageId.value,
    dueDate: date.value || '',
    remind: remind.value,
    offsets: payloadOffsets,
    channels: remind.value ? selectedChannels.value : undefined,
  };
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    const plan = buildPlan();
    const saved = isEdit.value
      ? await scheduleMilestone(props.engagementId, props.milestone!.id, plan)
      : await createMilestone(props.engagementId, plan);

    const reminderCount = saved.reminderOffsets?.length ?? (saved.remind ? 1 : 0);
    if (saved.remind && saved.reminder) {
      toast.success(`${isEdit.value ? 'Milestone updated' : 'Milestone added'} — ${reminderCount} reminder${reminderCount === 1 ? '' : 's'} scheduled`);
    } else if (remind.value && !date.value) {
      toast.info('Saved. Set a due date for the reminder to fire.');
    } else {
      toast.success(isEdit.value ? 'Milestone updated' : 'Milestone added');
    }
    emit('saved', saved);
    isOpen.value = false;
  } catch (err: any) {
    toast.error(err?.message || 'Could not save milestone');
  } finally {
    submitting.value = false;
  }
}

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
</script>

<template>
  <DefineTemplate>
    <div class="flex flex-col gap-4 py-2">
      <!-- Label -->
      <div class="flex flex-col gap-1.5">
        <Label for="ms-label">Milestone</Label>
        <Input id="ms-label" v-model="label" placeholder="e.g. File registration forms, Client sign-off" />
      </div>

      <!-- Stage (only when the engagement has stages) -->
      <div v-if="stages.length" class="flex flex-col gap-1.5">
        <Label>Stage <span class="text-muted-foreground font-normal">(optional)</span></Label>
        <Select v-model="stageId">
          <SelectTrigger>
            <SelectValue placeholder="No stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No stage</SelectItem>
            <SelectItem v-for="s in stages" :key="s.id" :value="s.id">{{ s.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Due date -->
      <div class="flex flex-col gap-1.5">
        <Label for="ms-date">Due date</Label>
        <Input id="ms-date" type="date" v-model="date" :min="todayIso()" />
      </div>

      <!-- Reminder master toggle -->
      <label class="flex flex-row items-center gap-2 text-sm cursor-pointer">
        <Checkbox :model-value="remind" @update:model-value="(v: any) => remind = !!v" />
        <Bell class="size-3.5 text-muted-foreground" />
        Remind me about this
      </label>

      <!-- Reminder cadence -->
      <div v-if="remind" class="flex flex-col gap-2">
        <div class="flex flex-row border rounded-md w-full" role="group">
          <Button type="button" @click="mode = 'single'" :variant="mode === 'single' ? 'secondary' : 'ghost'" size="sm" class="rounded-r-none flex-1">
            On the day
          </Button>
          <Button type="button" @click="mode = 'series'" :variant="mode === 'series' ? 'secondary' : 'ghost'" size="sm" class="rounded-l-none flex-1">
            Incremental
          </Button>
        </div>

        <p v-if="mode === 'single'" class="text-xs text-muted-foreground">
          A single reminder on the due date.
        </p>

        <div v-else class="flex flex-col gap-2 rounded-md border p-3 bg-muted/30">
          <span class="text-xs text-muted-foreground">Remind me this many days before:</span>
          <div class="flex flex-col gap-2">
            <div v-for="(_, i) in offsets" :key="i" class="flex flex-row items-center gap-2">
              <Bell class="size-3.5 text-muted-foreground shrink-0" />
              <Input type="number" min="1" v-model.number="offsets[i]" class="h-8 w-20" />
              <span class="text-sm text-muted-foreground">day(s) before</span>
              <Button type="button" variant="ghost" size="icon" class="h-7 w-7 ml-auto" @click="removeOffset(i)">
                <X class="size-3.5" />
              </Button>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" class="self-start h-8" @click="addOffset">
            <Plus class="size-3.5 mr-1" /> Add reminder
          </Button>
          <label class="flex flex-row items-center gap-2 text-sm mt-1 cursor-pointer">
            <Checkbox :model-value="remindOnDay" @update:model-value="(v: any) => remindOnDay = !!v" />
            Also remind me on the day
          </label>
        </div>

        <!-- Channels -->
        <div class="flex flex-col gap-2 mt-1">
          <Label>Notify via</Label>
          <div class="flex flex-row gap-4 flex-wrap">
            <label class="flex flex-row items-center gap-2 text-sm cursor-pointer">
              <Checkbox :model-value="channels.APP" @update:model-value="(v: any) => channels.APP = !!v" /> In-app
            </label>
            <label class="flex flex-row items-center gap-2 text-sm cursor-pointer">
              <Checkbox :model-value="channels.PUSH" @update:model-value="(v: any) => channels.PUSH = !!v" /> Push
            </label>
            <label class="flex flex-row items-center gap-2 text-sm cursor-pointer">
              <Checkbox :model-value="channels.EMAIL" @update:model-value="(v: any) => channels.EMAIL = !!v" /> Email
            </label>
          </div>
        </div>

        <p class="text-[11px] text-muted-foreground flex items-center gap-1">
          <Sparkles class="size-3" /> The assistant writes each reminder's wording from this engagement's context.
        </p>
      </div>
    </div>
  </DefineTemplate>

  <Drawer :close-threshold="0.95" v-if="$viewport.isLessThan('tablet')" v-model:open="isOpen">
    <DrawerContent class="sm:max-w-md max-h-[90dvh] overflow-y-auto">
      <DrawerHeader>
        <DrawerTitle class="flex items-center gap-2">
          <CalendarClock class="size-5" /> {{ isEdit ? 'Milestone schedule' : 'Add milestone' }}
        </DrawerTitle>
        <DrawerDescription>
          Set a due date and choose when to be reminded.
        </DrawerDescription>
      </DrawerHeader>
      <div class="flex flex-col px-5">
        <ReuseTemplate />
      </div>
      <DrawerFooter>
        <Button variant="outline" @click="isOpen = false" :disabled="submitting">Cancel</Button>
        <Button :disabled="!canSubmit || submitting" @click="submit">
          <Loader2 v-if="submitting" class="size-4 mr-2 animate-spin" />
          {{ isEdit ? 'Save' : 'Add milestone' }}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
  <Dialog v-else v-model:open="isOpen">
    <DialogContent class="sm:max-w-md max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CalendarClock class="size-5" /> {{ isEdit ? 'Milestone schedule' : 'Add milestone' }}
        </DialogTitle>
        <DialogDescription>
          Set a due date and choose when to be reminded.
        </DialogDescription>
      </DialogHeader>
      <ReuseTemplate />
      <DialogFooter>
        <Button variant="outline" @click="isOpen = false" :disabled="submitting">Cancel</Button>
        <Button :disabled="!canSubmit || submitting" @click="submit">
          <Loader2 v-if="submitting" class="size-4 mr-2 animate-spin" />
          {{ isEdit ? 'Save' : 'Add milestone' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
