<template>
  <DefineTemplate>
    <div class="flex flex-col gap-6 w-full h-full overflow-y-scroll p-3">
      <div class="flex flex-col gap-1">
        <span class="font-semibold text-sm ibm-plex-serif">Deadline Name</span>
        <Input v-model="_deadline.name" />
        <span class="text-xs text-muted-foreground">This is the display name of the deadline.</span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold text-sm ibm-plex-serif">Input Prompt</span>
        <Textarea v-model="_deadline.prompts.input" />
        <span class="text-xs text-muted-foreground">This is the question asked to the user when setting the deadline date e.g "When was the summon filed?"</span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold text-sm ibm-plex-serif">Pending Prompt</span>
        <Textarea v-model="_deadline.prompts.pending" />
        <span class="text-xs text-muted-foreground">This is what will be displayed when the deadline is pending e.g "The summon must be filed by <b>&lt;&lt;date&gt;&gt;</b>. (<b>&lt;&lt;from_now&gt;&gt;</b>)". Use "<b>&lt;&lt;date&gt;&gt;</b>", <b>&lt;&lt;from_now&gt;&gt;</b> to allow the system to add the date and time for you.</span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold text-sm ibm-plex-serif">Fulfilled Prompt</span>
        <Textarea v-model="_deadline.prompts.fulfilled" />
        <span class="text-xs text-muted-foreground">This is what will be displayed when the deadline is completed e.g "The summon was filed on <b>&lt;&lt;date&gt;&gt;</b>". Use "<b>&lt;&lt;date&gt;&gt;</b>", <b>&lt;&lt;from_now&gt;&gt;</b> to allow the system to add the date and time for you.</span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold text-sm ibm-plex-serif">Offset Days</span>
        <NumberField v-model="_deadline.offset.days" :min="0">
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
        <span class="text-xs text-muted-foreground">This is the number of days to this deadline from the previous deadline
          </span>
      </div>

      <div class="flex flex-row items-center gap-3 p-3 border rounded-lg">
        <div class="flex flex-col w-full">
          <span class="font-semibold text-sm ibm-plex-serif">Allow Weekends</span>
          <span class="text-xs text-muted-foreground">Allow this deadline's due date to fall on a weekend. If not, the due date shall be moved to the next working day.</span>
        </div>

        <Switch v-model="_deadline.offset.allowWeekends" />
      </div>

      <div class="flex flex-row items-center gap-3 p-3 border rounded-lg">
        <div class="flex flex-col w-full">
          <span class="font-semibold text-sm ibm-plex-serif">Allow Holidays</span>
          <span class="text-xs text-muted-foreground">Allow this deadline's due date to fall on public holiday. If not, the due date shall be moved to the next working day.</span>
        </div>

        <Switch v-model="_deadline.offset.allowHolidays" />
      </div>

      <div class="flex flex-row items-center gap-3 p-3 border rounded-lg">
        <div class="flex flex-col w-full">
          <span class="font-semibold text-sm ibm-plex-serif">Ignore Weekends</span>
          <span class="text-xs text-muted-foreground">When counting dates, should the deadline engine count weekends. If yes, the deadline engine shall include weekends in its counting.</span>
        </div>

        <Switch v-model="_deadline.offset.ignoreWeekends" />
      </div>

      <div class="flex flex-row items-center gap-3 p-3 border rounded-lg">
        <div class="flex flex-col w-full">
          <span class="font-semibold text-sm ibm-plex-serif">Ignore Holidays</span>
          <span class="text-xs text-muted-foreground">When counting dates, should the deadline engine count holidays. If yes, the deadline engine shall include holidays in its counting.</span>
        </div>
        <Switch v-model="_deadline.offset.ignoreHolidays" />
      </div>

      <div class="flex flex-row items-center gap-3 p-3 border rounded-lg">
        <div class="flex flex-col w-full">
          <span class="font-semibold text-sm ibm-plex-serif">Include First Day</span>
          <span class="text-xs text-muted-foreground">If yes, the deadline engine shall begin counting days from the first day, otherwise the days shall be counted beginning from the following day.</span>
        </div>
        <Switch v-model="_deadline.offset.includeFirst" />
      </div>

      <SharedTemplatesReminderManager @update:reminders="r => _deadline.reminders = r" :reminders="_deadline.reminders">
        <button class="flex text-left flex-col border rounded-lg bg-muted hover:bg-muted/80 p-3 transition-colors w-full">
          <div class="flex flex-row items-center justify-between w-full">
            <div class="flex flex-col">
              <span class="font-semibold text-sm ibm-plex-serif">Reminders</span>
              <span class="text-xs text-muted-foreground">Click here to customize the reminders to send.</span>
            </div>
            <Bell class="size-5 text-muted-foreground" />
          </div>

          <div class="flex flex-row items-center gap-2 mt-2">
            <div class="size-6 bg-primary text-primary-foreground rounded-full grid place-items-center text-xs font-semibold">
              {{ _deadline.reminders?.length || 0 }}
            </div>
            <span class="text-xs text-muted-foreground">reminder(s) configured</span>
          </div>
        </button>
      </SharedTemplatesReminderManager>
    </div>
  </DefineTemplate>

  <ReuseTemplate v-if="noSheet" />

  <Sheet v-else>
    <SheetTrigger as-child class="w-fit items-start">
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full xs:pb-12 lg:pb-0 xs:pt-5 lg:pt-0">
      <SheetHeader>
        <SheetTitle>Deadline</SheetTitle>
      </SheetHeader>

      <ReuseTemplate />
    </SheetContent>
  </Sheet>
</template>

<script setup>
import { reminderGenerator } from '@/services/intelligence';
import { toast } from "vue-sonner";
import { Bell } from 'lucide-vue-next';

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const props = defineProps(['deadline', 'noSheet']);
const emits = defineEmits(['update:deadline']);

const _deadline = computed({
  get: () => props.deadline,
  set: (v) => emits('update:deadline', v)
});

// Watch for deep changes in deadline and emit updates
watch(() => props.deadline, (newVal) => {
  if (newVal) {
    emits('update:deadline', newVal);
  }
}, { deep: true });

</script>