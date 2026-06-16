<script setup lang="ts">
import { Bell, Briefcase, User, Check, Loader2, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { markReminderDone, deleteReminder } from '~/services/reminders';

const props = defineProps<{ reminder: any }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const busy = ref(false);

const isCase = computed(() => !!props.reminder.expand?.matter);
const scopeLabel = computed(() => props.reminder.expand?.matter?.name || 'Personal');
const isDone = computed(() => props.reminder.status === 'done');

// "13:45" -> "1:45 PM"
const fmtTime = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

async function toggleDone() {
  if (busy.value || isDone.value) return;
  busy.value = true;
  try {
    await markReminderDone(props.reminder.id);
    toast.success('Marked done');
    emit('changed');
  } catch (e: any) {
    toast.error(e?.message || 'Failed to update');
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (busy.value) return;
  busy.value = true;
  try {
    await deleteReminder(props.reminder.id);
    toast.success('Event removed');
    emit('changed');
  } catch (e: any) {
    toast.error(e?.message || 'Failed to remove');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 p-3 border rounded-lg bg-background" :class="{ 'opacity-60': isDone }">
    <div class="flex flex-row items-start gap-2">
      <Bell class="size-4 mt-0.5 text-muted-foreground shrink-0" />
      <div class="flex flex-col flex-1 min-w-0">
        <p class="text-sm font-medium truncate" :class="{ 'line-through': isDone }">{{ reminder.title }}</p>
        <div class="flex flex-row items-center gap-2 flex-wrap mt-1">
          <Badge variant="secondary" class="gap-1 text-[11px]">
            <component :is="isCase ? Briefcase : User" class="size-3" />
            {{ scopeLabel }}
          </Badge>
          <span v-if="reminder.atTime" class="text-[11px] text-muted-foreground">{{ fmtTime(reminder.atTime) }}</span>
          <Badge v-if="reminder.mode === 'series'" variant="outline" class="text-[11px]">Series</Badge>
        </div>
      </div>
    </div>
    <div class="flex flex-row gap-2">
      <Button v-if="!isDone" variant="outline" size="sm" class="h-7 flex-1" :disabled="busy" @click="toggleDone">
        <Loader2 v-if="busy" class="size-3.5 mr-1 animate-spin" />
        <Check v-else class="size-3.5 mr-1" /> Done
      </Button>
      <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="busy" @click="remove" aria-label="Remove event">
        <Trash2 class="size-3.5" />
      </Button>
    </div>
  </div>
</template>
