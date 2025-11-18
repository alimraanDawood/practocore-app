<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[550px]">
      <DialogHeader>
        <DialogTitle>{{ reminder?.title || 'Deadline Reminder' }}</DialogTitle>
        <DialogDescription>
          {{ formatDate(reminder?.date) }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Deadline Info -->
        <div class="rounded-lg border p-4 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Deadline</span>
            <Badge :variant="getPriorityVariant(reminder?.priority)">
              {{ reminder?.priority || 'informative' }}
            </Badge>
          </div>
          <p class="text-sm font-medium">{{ deadline?.name }}</p>
          <p class="text-xs text-muted-foreground">
            <strong>Due:</strong> {{ formatDate(deadline?.date) }}
          </p>
        </div>

        <!-- Matter Info -->
        <div class="rounded-lg border p-4 space-y-2">
          <span class="text-sm font-medium">Matter</span>
          <p class="text-sm text-muted-foreground">{{ matter?.name }}</p>
          <p class="text-xs text-muted-foreground" v-if="matter?.caseNumber">
            Case #{{ matter.caseNumber }}
          </p>
        </div>

        <!-- Reminder Body -->
        <div v-if="reminder?.bodyHTML" class="rounded-lg border p-4 prose prose-sm dark:prose-invert max-w-none">
          <div v-html="reminder.bodyHTML" />
        </div>
        <div v-else-if="reminder?.body" class="rounded-lg border p-4 text-sm text-muted-foreground">
          {{ reminder.body }}
        </div>
      </div>

      <DialogFooter class="flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          @click="handleAcknowledge"
          :disabled="processing"
          class="w-full sm:w-auto"
        >
          <Icon v-if="processing === 'acknowledge'" name="lucide:loader-2" class="h-4 w-4 mr-2 animate-spin" />
          <Icon v-else name="lucide:check" class="h-4 w-4 mr-2" />
          Acknowledge
        </Button>
        <Button
          variant="default"
          @click="handleFulfill"
          :disabled="processing"
          class="w-full sm:w-auto"
        >
          <Icon v-if="processing === 'fulfill'" name="lucide:loader-2" class="h-4 w-4 mr-2 animate-spin" />
          <Icon v-else name="lucide:check-check" class="h-4 w-4 mr-2" />
          Mark as Fulfilled
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { acknowledgeReminder, fulfillDeadline } from '~/services/matters';
import { useToast } from '~/components/ui/toast';
import type { DeadlineRemindersRecord, DeadlinesRecord, MattersRecord } from '~/lib/pocketbase-types';

const props = defineProps<{
  reminder: DeadlineRemindersRecord | null;
  deadline: DeadlinesRecord | null;
  matter: MattersRecord | null;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'acknowledged': [];
  'fulfilled': [];
}>();

const { toast } = useToast();
const processing = ref<'acknowledge' | 'fulfill' | null>(null);

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

async function handleAcknowledge() {
  if (!props.reminder?.id || processing.value) return;

  try {
    processing.value = 'acknowledge';
    await acknowledgeReminder(props.reminder.id);

    toast({
      title: 'Reminder Acknowledged',
      description: 'The reminder has been marked as acknowledged.',
    });

    emit('acknowledged');
    open.value = false;
  } catch (error) {
    console.error('Failed to acknowledge reminder:', error);
    toast({
      title: 'Error',
      description: 'Failed to acknowledge reminder. Please try again.',
      variant: 'destructive',
    });
  } finally {
    processing.value = null;
  }
}

async function handleFulfill() {
  if (!props.deadline?.id || processing.value) return;

  try {
    processing.value = 'fulfill';
    await fulfillDeadline(props.deadline.id);

    toast({
      title: 'Deadline Fulfilled',
      description: 'The deadline has been marked as fulfilled and all reminders have been deactivated.',
    });

    emit('fulfilled');
    open.value = false;
  } catch (error) {
    console.error('Failed to fulfill deadline:', error);
    toast({
      title: 'Error',
      description: 'Failed to fulfill deadline. Please try again.',
      variant: 'destructive',
    });
  } finally {
    processing.value = null;
  }
}

function formatDate(date: string | undefined) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getPriorityVariant(priority: string | undefined) {
  const variants: Record<string, string> = {
    critical: 'destructive',
    urgent: 'default',
    moderate: 'secondary',
    informative: 'outline'
  };
  return variants[priority || 'informative'] || 'outline';
}
</script>
