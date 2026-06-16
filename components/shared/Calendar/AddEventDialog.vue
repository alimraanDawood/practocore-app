<script setup lang="ts">
import { CalendarPlus, Plus, X, Bell, Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { pb } from '~/lib/pocketbase';
import { scheduleEvent } from '~/services/reminders';

const props = withDefaults(defineProps<{
  open: boolean;
  /** Pre-fill the event date (YYYY-MM-DD). */
  defaultDate?: string;
}>(), { defaultDate: '' });

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'created'): void;
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

// ── Form state ──────────────────────────────────────────────────────────────
const title = ref('');
const date = ref('');
const time = ref('');
const mode = ref<'single' | 'series'>('single');
// Lead times (days before the event) for incremental reminders. The "on the day"
// touchpoint is controlled separately so a series always lands on the date too.
const offsets = ref<number[]>([7, 1]);
const remindOnDay = ref(true);
// reka-ui Select forbids empty-string item values, so "personal" is the sentinel
// for "no case".
const matterId = ref<string>('personal');
const channels = reactive({ APP: true, EMAIL: true, PUSH: true });

const matters = ref<{ id: string; name: string }[]>([]);
const submitting = ref(false);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function resetForm() {
  title.value = '';
  const today = todayIso();
  // Don't pre-fill a past date (the calendar may be on an earlier day).
  date.value = props.defaultDate && props.defaultDate >= today ? props.defaultDate : today;
  time.value = '';
  mode.value = 'single';
  offsets.value = [7, 1];
  remindOnDay.value = true;
  matterId.value = 'personal';
  channels.APP = true;
  channels.EMAIL = true;
  channels.PUSH = true;
}

watch(isOpen, async (open) => {
  if (!open) return;
  resetForm();
  if (matters.value.length === 0) {
    try {
      matters.value = await pb.collection('Matters').getFullList({ sort: '-created', fields: 'id,name' });
    } catch { /* list rule may scope to none — ignore */ }
  }
});

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
  title.value.trim().length > 0 &&
  !!date.value &&
  selectedChannels.value.length > 0 &&
  (mode.value === 'single' || offsets.value.length > 0 || remindOnDay.value)
);

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    let payloadOffsets: number[];
    if (mode.value === 'single') {
      payloadOffsets = [0];
    } else {
      payloadOffsets = [...offsets.value.filter((n) => Number.isFinite(n) && n > 0)];
      if (remindOnDay.value) payloadOffsets.push(0);
      if (payloadOffsets.length === 0) payloadOffsets = [0];
    }

    const res = await scheduleEvent({
      title: title.value.trim(),
      targetDate: date.value,
      atTime: time.value || undefined,
      matterId: matterId.value && matterId.value !== 'personal' ? matterId.value : undefined,
      mode: mode.value,
      offsets: payloadOffsets,
      channels: selectedChannels.value,
    });

    const n = res?.scheduled?.length ?? 0;
    toast.success(`Event added — ${n} reminder${n === 1 ? '' : 's'} scheduled`);
    emit('created');
    isOpen.value = false;
  } catch (err: any) {
    toast.error(err?.message || 'Failed to add event');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-md max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CalendarPlus class="size-5" /> Add Event
        </DialogTitle>
        <DialogDescription>
          Add an event to your calendar and choose when to be reminded.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <!-- Title -->
        <div class="flex flex-col gap-1.5">
          <Label for="event-title">Title</Label>
          <Input id="event-title" v-model="title" placeholder="e.g. File submissions, Client meeting" />
        </div>

        <!-- Date + time -->
        <div class="flex flex-row gap-3">
          <div class="flex flex-col gap-1.5 flex-1">
            <Label for="event-date">Date</Label>
            <Input id="event-date" type="date" v-model="date" :min="todayIso()" />
          </div>
          <div class="flex flex-col gap-1.5 w-32">
            <Label for="event-time">Time <span class="text-muted-foreground font-normal">(opt.)</span></Label>
            <Input id="event-time" type="time" v-model="time" />
          </div>
        </div>

        <!-- Matter (optional) -->
        <div class="flex flex-col gap-1.5">
          <Label>Case <span class="text-muted-foreground font-normal">(optional)</span></Label>
          <Select v-model="matterId">
            <SelectTrigger>
              <SelectValue placeholder="Personal — no case" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal — no case</SelectItem>
              <SelectItem v-for="m in matters" :key="m.id" :value="m.id">{{ m.name }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Reminder cadence -->
        <div class="flex flex-col gap-2">
          <Label>Reminders</Label>
          <div class="flex flex-row border rounded-md w-full" role="group">
            <Button type="button" @click="mode = 'single'" :variant="mode === 'single' ? 'secondary' : 'ghost'" size="sm" class="rounded-r-none flex-1">
              On the day
            </Button>
            <Button type="button" @click="mode = 'series'" :variant="mode === 'series' ? 'secondary' : 'ghost'" size="sm" class="rounded-l-none flex-1">
              Incremental
            </Button>
          </div>

          <p v-if="mode === 'single'" class="text-xs text-muted-foreground">
            A single reminder on the event date.
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
        </div>

        <!-- Channels -->
        <div class="flex flex-col gap-2">
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
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false" :disabled="submitting">Cancel</Button>
        <Button :disabled="!canSubmit || submitting" @click="submit">
          <Loader2 v-if="submitting" class="size-4 mr-2 animate-spin" />
          Add Event
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
