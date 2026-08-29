<template>
  <!-- Read-only badge for anyone who cannot change the state. A closed file must
       still LOOK closed to the associate reading it. -->
  <Badge v-if="!canManage && status !== 'active'" :variant="badgeVariant" class="gap-1.5">
    <component :is="statusIcon" class="size-3" aria-hidden="true" />
    {{ label }}
  </Badge>

  <Dialog v-else-if="canManage" v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm" class="gap-2">
        <component :is="statusIcon" class="size-4" aria-hidden="true" />
        {{ label }}
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Matter status</DialogTitle>
        <DialogDescription>
          {{ matter?.name }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 py-1">
        <RadioGroup :model-value="choice" @update:model-value="v => choice = v as MatterStatus">
          <div v-for="opt in options" :key="opt.value" class="flex items-start gap-2">
            <RadioGroupItem :id="`matter-status-${opt.value}`" :value="opt.value" class="mt-0.5" />
            <Label :for="`matter-status-${opt.value}`" class="flex flex-col items-start gap-0.5 font-normal cursor-pointer">
              <span class="font-medium">{{ opt.label }}</span>
              <span class="text-xs text-muted-foreground">{{ opt.hint }}</span>
            </Label>
          </div>
        </RadioGroup>

        <div v-if="choice !== 'active'" class="flex flex-col gap-1.5">
          <Label for="matter-closure-reason">Reason</Label>
          <Input
            id="matter-closure-reason"
            v-model="reason"
            placeholder="Settled at mediation, judgment delivered, withdrawn…"
          />
          <p class="text-xs text-muted-foreground">
            Recorded on the file. Deadlines are kept — the case record stays readable.
          </p>
        </div>

        <p v-else-if="status !== 'active'" class="text-xs text-muted-foreground">
          Reopening clears the closure date and reason. Reminders stood down when it
          closed are not restored — check the dates before relying on them.
        </p>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="ghost" :disabled="saving" @click="open = false">Cancel</Button>
        <Button :disabled="saving || choice === status" @click="save">
          <LoaderIcon v-if="saving" class="size-4 animate-spin" />
          {{ choice === 'active' ? 'Reopen matter' : choice === 'archived' ? 'Archive matter' : 'Close matter' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner';
import { CircleDot, CircleCheck, Archive, LoaderIcon } from 'lucide-vue-next';
import {
  setMatterStatus,
  matterStatusOf,
  MATTER_STATUS_LABELS,
  type MatterStatus,
} from '~/services/matters';

const props = defineProps<{
  matter: any;
  /** Whether the current user may change the state (owner or supervisor). */
  canManage?: boolean;
}>();
const emits = defineEmits<{ updated: [] }>();

const open = ref(false);
const saving = ref(false);
const reason = ref('');

const status = computed<MatterStatus>(() => matterStatusOf(props.matter));
const label = computed(() => MATTER_STATUS_LABELS[status.value]);

// The dialog's working copy, reset each time it opens so an abandoned edit never
// carries into the next one.
const choice = ref<MatterStatus>(status.value);
watch(open, (isOpen) => {
  if (!isOpen) return;
  choice.value = status.value;
  reason.value = props.matter?.closureReason ?? '';
});

const statusIcon = computed(() =>
  status.value === 'archived' ? Archive : status.value === 'closed' ? CircleCheck : CircleDot,
);
const badgeVariant = computed(() => (status.value === 'archived' ? 'outline' : 'secondary'));

const options: { value: MatterStatus; label: string; hint: string }[] = [
  { value: 'active', label: 'Active', hint: 'The live file — deadlines run and reminders fire.' },
  { value: 'closed', label: 'Closed', hint: 'The work is over. Hidden from the default matters list.' },
  { value: 'archived', label: 'Archived', hint: 'Closed and put away. Hidden unless you ask for archived matters.' },
];

async function save() {
  if (saving.value || !props.matter?.id) return;
  saving.value = true;
  try {
    await setMatterStatus(props.matter.id, choice.value, reason.value.trim());
    toast.success(
      choice.value === 'active'
        ? 'Matter reopened.'
        : `Matter ${choice.value === 'archived' ? 'archived' : 'closed'}.`,
    );
    open.value = false;
    emits('updated');
  } catch (e: any) {
    toast.error(e?.message || 'Could not update the matter status.');
  } finally {
    saving.value = false;
  }
}
</script>
