<template>
  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
    <DialogTrigger :as-child="true">
      <slot />
    </DialogTrigger>

    <DialogContent side="bottom">
      <DialogHeader>
        <DialogTitle>Enter Date</DialogTitle>
        <DialogDescription>
          {{ event.input_prompt }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col p-3">
        <Popover>
          <PopoverTrigger as-child>
            <Button
                variant="outline"
                :class="cn(
                                'w-full justify-start text-left font-normal',
                                !dateValue && 'text-muted-foreground',
                            )">
              <CalendarIcon class="mr-2 h-4 w-4" />
              {{ dateValue ? df.format(dateValue.toDate(getLocalTimeZone())) : "Pick a date" }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar v-model="dateValue" initial-focus />
          </PopoverContent>
        </Popover>
      </div>

      <DialogFooter>
        <Button
            @click="_fulfillDeadline"
            class="disabled:opacity-50 "
            :disabled="loading">
          <span v-if="!loading">Use Date</span>
          <Loader v-else class="animate-spin" />
        </Button>
        <DialogClose class="w-full lg:w-fit">
          <Button class="w-full" variant="secondary">Cancel</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Sheet v-else v-model:open="open">
    <SheetTrigger :as-child="true">
      <slot />
    </SheetTrigger>

    <SheetContent side="bottom">
      <SheetHeader>
        <SheetTitle>Enter Date</SheetTitle>
        <SheetDescription>
          {{ event.input_prompt }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col p-3">
        <Popover>
          <PopoverTrigger as-child>
            <Button
                variant="outline"
                :class="cn(
                                'w-full justify-start text-left font-normal',
                                !dateValue && 'text-muted-foreground',
                            )">
              <CalendarIcon class="mr-2 h-4 w-4" />
              {{ dateValue ? df.format(dateValue.toDate(getLocalTimeZone())) : "Pick a date" }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar v-model="dateValue" initial-focus />
          </PopoverContent>
        </Popover>
      </div>

      <SheetFooter>
        <Button
            @click="_fulfillDeadline"
            class="disabled:opacity-50"
            :disabled="loading">
          <span v-if="!loading">Use Date</span>
          <Loader v-else class="animate-spin" />
        </Button>
        <SheetClose class="w-full">
          <Button class="w-full" variant="secondary">Cancel</Button>
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import { DateFormatter, getLocalTimeZone, today, parseDate } from "@internationalized/date";
import { toast } from 'vue-sonner';
import {updateDeadline, fulfillDeadline, resetDeadline as resetDeadlineService, fulfillEvent} from '~/services/matters';
import { Loader, CalendarIcon, TriangleAlert } from 'lucide-vue-next';
import { Calendar } from '~/components/ui/calendar';
import { cn } from '~/lib/utils';
import { getSignedInUser } from '~/services/auth';
import {toDate} from "reka-ui/date";

const props = defineProps(['event', 'index']);
const emits = defineEmits(['updated']);


const dateValue = ref(
    props.event?.date && props.event?.status === "fulfilled" ? parseDate(props.event.date.slice(0, 10)) : today('utc')
) as Ref<DateValue>;
const loading = ref(false);
const open = ref(false);

const df = new DateFormatter("en-US", {
  dateStyle: "long",
});

const _fulfillDeadline = async () => {
  loading.value = true;
  try {
    const result = await fulfillEvent(props.event,  toDate(dateValue.value, 'utc').toISOString().split('T')[0]);

    open.value = false;
    toast.success("Successfully updated event!");
    emits("updated");
  } catch (e) {
    toast.error('We were unable to update your event!');
    console.error(e);
  }
  loading.value = false;
}

const resetDeadline = async () => {
  loading.value = true;
  try {
    // Use the dedicated reset endpoint
    await resetDeadlineService(props.event?.id);

    open.value = false;
    toast.success("Successfully reset event!");
    emits("updated");
  } catch (e) {
    toast.error('We were unable to reset your event!');
    console.error(e);
  }
  loading.value = false;
}
</script>