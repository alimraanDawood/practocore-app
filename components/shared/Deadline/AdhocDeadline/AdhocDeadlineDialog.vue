<script setup lang="ts">
import { CalendarPlus, Plus, X, Bell, Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  createAdhocDeadline, updateAdhocDeadline,
  type AdhocDeadlineInput,
} from '~/services/matters';

/**
 * Add or edit a deadline the FIRM tracks itself on a litigation matter.
 *
 * This never touches court deadlines — those are generated from the matter's
 * procedure, carry statutory authority, and move only by adjourning them. The
 * backend refuses any attempt to edit one through here, so the timeline only ever
 * offers this dialog on rows with `origin === 'adhoc'`.
 *
 * Mirrors Engagements/MilestoneScheduleDialog.vue deliberately: the two surfaces
 * do the same job on either side of the product and should feel identical.
 */
const props = withDefaults(defineProps<{
  open: boolean;
  matterId: string;
  /** Editing an existing ad-hoc deadline; omit to add a new one. */
  deadline?: any | null;
}>(), { deadline: null });

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved'): void;
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const isEdit = computed(() => !!props.deadline);

// ── Form state ──────────────────────────────────────────────────────────────
const name = ref('');
const date = ref('');
const description = ref('');
const remind = ref(true);
const offsets = ref<number[]>([7, 1]);
const remindOnDay = ref(true);
const submitting = ref(false);

function resetForm() {
  const d = props.deadline;
  name.value = d?.name ?? '';
  date.value = d?.date ? String(d.date).slice(0, 10) : '';
  description.value = d?.description ?? '';

  const saved: number[] = Array.isArray(d?.reminderOffsets) ? d.reminderOffsets : [];
  if (d) {
    remind.value = saved.length > 0;
    const positive = saved.filter((n) => n > 0);
    offsets.value = positive.length > 0 ? positive : [7, 1];
    remindOnDay.value = saved.includes(0);
  } else {
    remind.value = true;
    offsets.value = [7, 1];
    remindOnDay.value = true;
  }
}

watch(isOpen, (open) => { if (open) resetForm(); });

function addOffset() { offsets.value.push(3); }
function removeOffset(i: number) { offsets.value.splice(i, 1); }

const canSubmit = computed(() => name.value.trim().length > 0);

function buildOffsets(): number[] {
  if (!remind.value) return [];
  const out = offsets.value.filter((n) => Number.isFinite(n) && n > 0);
  if (remindOnDay.value || out.length === 0) out.push(0);
  return [...new Set(out)];
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    const payload: AdhocDeadlineInput = {
      name: name.value.trim(),
      date: date.value || '',
      description: description.value.trim(),
      reminderOffsets: buildOffsets(),
    };
    const res = isEdit.value
      ? await updateAdhocDeadline(props.deadline.id, payload)
      : await createAdhocDeadline(props.matterId, payload);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    if (remind.value && !date.value) {
      toast.info('Saved. Set a due date for the reminder to fire.');
    } else {
      toast.success(isEdit.value ? 'Deadline updated' : 'Deadline added');
    }
    emit('saved');
    isOpen.value = false;
  } catch (err: any) {
    toast.error(err?.message || 'Could not save deadline');
  } finally {
    submitting.value = false;
  }
}

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
</script>

<template>
  <DefineTemplate>
    <div class="flex flex-col gap-4 py-2">
      <div class="flex flex-col gap-1.5">
        <Label for="adhoc-name">Deadline</Label>
        <Input
          id="adhoc-name"
          v-model="name"
          placeholder="e.g. Collect certified record from the registry"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="adhoc-date">
          Due date <span class="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="adhoc-date" type="date" v-model="date" />
        <p class="text-[11px] text-muted-foreground">
          Leave blank to track it without a date. Reminders only fire once a date is set.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="adhoc-description">
          Notes <span class="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="adhoc-description"
          v-model="description"
          rows="2"
          placeholder="What has to be done, and by whom"
        />
      </div>

      <label class="flex flex-row items-center gap-2 text-sm cursor-pointer">
        <Checkbox :model-value="remind" @update:model-value="(v: any) => remind = !!v" />
        <Bell class="size-3.5 text-muted-foreground" />
        Remind me about this
      </label>

      <div v-if="remind" class="flex flex-col gap-2 rounded-md border p-3 bg-muted/30">
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

      <p class="text-[11px] text-muted-foreground border-t border-border/60 pt-3">
        This is a deadline your firm tracks itself. It sits alongside the court deadlines
        for this matter but is not generated from the rules, and changing it never affects them.
      </p>
    </div>
  </DefineTemplate>

  <Drawer :close-threshold="0.95" v-if="$viewport.isLessThan('tablet')" v-model:open="isOpen">
    <DrawerContent class="sm:max-w-md max-h-[95dvh]">
      <DrawerHeader class="border-b">
        <DrawerTitle class="flex items-center gap-2">
          <CalendarPlus class="size-5" /> {{ isEdit ? 'Edit deadline' : 'Add a deadline' }}
        </DrawerTitle>
        <DrawerDescription>
          A deadline your firm tracks, separate from the court's own dates.
        </DrawerDescription>
      </DrawerHeader>

      <div class="flex flex-col px-5 overflow-y-auto">
        <ReuseTemplate />
      </div>

      <DrawerFooter>
        <Button variant="outline" @click="isOpen = false" :disabled="submitting">Cancel</Button>
        <Button :disabled="!canSubmit || submitting" @click="submit">
          <Loader2 v-if="submitting" class="size-4 mr-2 animate-spin" />
          {{ isEdit ? 'Save' : 'Add deadline' }}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>

  <Dialog v-else v-model:open="isOpen">
    <DialogContent class="sm:max-w-md max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CalendarPlus class="size-5" /> {{ isEdit ? 'Edit deadline' : 'Add a deadline' }}
        </DialogTitle>
        <DialogDescription>
          A deadline your firm tracks, separate from the court's own dates.
        </DialogDescription>
      </DialogHeader>
      <ReuseTemplate />
      <DialogFooter>
        <Button variant="outline" @click="isOpen = false" :disabled="submitting">Cancel</Button>
        <Button :disabled="!canSubmit || submitting" @click="submit">
          <Loader2 v-if="submitting" class="size-4 mr-2 animate-spin" />
          {{ isEdit ? 'Save' : 'Add deadline' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
