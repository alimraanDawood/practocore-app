<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full overflow-y-hidden h-full">
      <SheetHeader>
        <SheetTitle>Reminders</SheetTitle>
        <SheetDescription>Configure reminders for this deadline</SheetDescription>
      </SheetHeader>

      <div class="flex flex-col h-full gap-4 p-3 overflow-y-scroll">
        <!-- Add New Reminder Button -->
        <Button @click="addReminder" variant="outline" class="w-full">
          <Plus class="size-4 mr-2" />
          Add Reminder
        </Button>

        <!-- Reminders List -->
        <div v-if="localReminders.length === 0" class="text-center text-muted-foreground py-8">
          <Bell class="size-12 mx-auto mb-2 opacity-50" />
          <p class="text-sm">No reminders set</p>
          <p class="text-xs">Click "Add Reminder" to create one</p>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div v-for="(reminder, index) in localReminders" :key="reminder.id"
               class="flex flex-col gap-3 p-4 border rounded-lg">
            <!-- Reminder Header -->
            <div class="flex flex-row items-start justify-between">
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs font-semibold text-muted-foreground">Reminder {{ index + 1 }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ Math.abs(reminder.offset) }} day(s) {{ reminder.offset < 0 ? 'before' : 'after' }} deadline
                </span>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="icon" variant="ghost" class="size-8">
                    <Trash class="size-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Reminder?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this reminder. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button @click="deleteReminder(index)" variant="destructive">Delete</Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <!-- Title -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold">Title</label>
              <Input v-model="reminder.title" placeholder="Reminder title" />
            </div>

            <!-- Body -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold">Message</label>
              <Textarea v-model="reminder.body" placeholder="Reminder message" rows="3" />
              <span class="text-xs text-muted-foreground">
                Use <code>&lt;&lt;first_name&gt;&gt;</code>, <code>&lt;&lt;deadline_date&gt;&gt;</code> for dynamic values
              </span>
            </div>

            <!-- HTML Body (Optional) -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold">HTML Message (Optional)</label>
              <Textarea v-model="reminder.bodyHTML" placeholder="HTML version of message" rows="2" />
              <span class="text-xs text-muted-foreground">
                Use <code>&lt;strong&gt;&lt;&lt;first_name&gt;&gt;&lt;/strong&gt;</code> for formatting
              </span>
            </div>

            <!-- Offset -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold">Timing</label>
              <div class="flex flex-row gap-2 items-center">
                <NumberField v-model="reminder.offset" :min="-365" :max="365">
                  <NumberFieldContent>
                    <NumberFieldDecrement />
                    <NumberFieldInput class="w-20" />
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
                <span class="text-sm text-muted-foreground">
                  day(s) {{ reminder.offset < 0 ? 'before' : reminder.offset > 0 ? 'after' : 'on' }} deadline
                </span>
              </div>
            </div>

            <!-- Priority -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold">Priority</label>
              <Select v-model="reminder.priority">
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderate">
                    <div class="flex items-center gap-2">
                      <div class="size-2 rounded-full bg-blue-500"></div>
                      Moderate
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div class="flex items-center gap-2">
                      <div class="size-2 rounded-full bg-orange-500"></div>
                      Urgent
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div class="flex items-center gap-2">
                      <div class="size-2 rounded-full bg-red-500"></div>
                      Critical
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Channels -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-semibold">Notification Channels</label>
              <div class="flex flex-col gap-2">
                <div class="flex flex-row items-center justify-between p-2 border rounded">
                  <div class="flex items-center gap-2">
                    <Mail class="size-4" />
                    <span class="text-sm">Email</span>
                  </div>
                  <Switch :checked="reminder.channels.includes('MAIL')"
                          @update:checked="(val) => toggleChannel(reminder, 'MAIL', val)" />
                </div>

                <div class="flex flex-row items-center justify-between p-2 border rounded">
                  <div class="flex items-center gap-2">
                    <Smartphone class="size-4" />
                    <span class="text-sm">App Notification</span>
                  </div>
                  <Switch :checked="reminder.channels.includes('APP')"
                          @update:checked="(val) => toggleChannel(reminder, 'APP', val)" />
                </div>

                <div class="flex flex-row items-center justify-between p-2 border rounded">
                  <div class="flex items-center gap-2">
                    <AlarmClock class="size-4" />
                    <span class="text-sm">Alarm</span>
                  </div>
                  <Switch :checked="reminder.channels.includes('ALARM')"
                          @update:checked="(val) => toggleChannel(reminder, 'ALARM', val)" />
                </div>
              </div>
            </div>

            <!-- Escalate -->
            <div class="flex flex-row items-center justify-between p-3 border rounded-lg">
              <div class="flex flex-col">
                <span class="text-sm font-semibold">Escalate to Supervisor</span>
                <span class="text-xs text-muted-foreground">Send a copy to the user's supervisor</span>
              </div>
              <Switch v-model="reminder.escalate" />
            </div>
          </div>
        </div>

        <!-- Save Button -->
      </div>
      <div class="flex flex-row gap-2 p-2">
        <Button @click="saveReminders" class="w-full">
          <Check class="size-4 mr-2" />
          Save Reminders
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup>
import { Plus, Trash, Bell, Mail, Smartphone, AlarmClock, Check } from 'lucide-vue-next';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'vue-sonner';

const props = defineProps({
  reminders: {
    type: Array,
    default: () => []
  }
});

const emits = defineEmits(['update:reminders']);

const isOpen = ref(false);
const localReminders = ref([]);

// Initialize local reminders when props change or dialog opens
watch([() => props.reminders, isOpen], () => {
  if (isOpen.value) {
    localReminders.value = JSON.parse(JSON.stringify(props.reminders || []));
  }
}, { immediate: true });

const addReminder = () => {
  const newReminder = {
    id: uuidv4(),
    title: 'New Reminder',
    body: '',
    bodyHTML: '',
    priority: 'moderate',
    escalate: false,
    offset: -7,
    channels: ['MAIL']
  };

  localReminders.value.push(newReminder);
  toast.success('Reminder added');
};

const deleteReminder = (index) => {
  localReminders.value.splice(index, 1);
  toast.success('Reminder deleted');
};

const toggleChannel = (reminder, channel, enabled) => {
  if (enabled) {
    if (!reminder.channels.includes(channel)) {
      reminder.channels.push(channel);
    }
  } else {
    reminder.channels = reminder.channels.filter(c => c !== channel);
  }
};

const saveReminders = () => {
  // Validate reminders
  for (const reminder of localReminders.value) {
    if (!reminder.title?.trim()) {
      toast.error('All reminders must have a title');
      return;
    }
    if (!reminder.body?.trim()) {
      toast.error('All reminders must have a message');
      return;
    }
    if (reminder.channels.length === 0) {
      toast.error('Each reminder must have at least one notification channel');
      return;
    }
  }

  emits('update:reminders', JSON.parse(JSON.stringify(localReminders.value)));
  isOpen.value = false;
  toast.success('Reminders saved successfully');
};
</script>
