<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone, parseDate, today } from "@internationalized/date"
import { toTypedSchema } from "@vee-validate/zod"
import { CalendarIcon } from "lucide-vue-next"
import { toDate } from "reka-ui/date"
import { useForm } from "vee-validate"
import { computed, h, ref } from "vue"
import { z } from "zod"
import { cn } from "@/lib/utils"

const emits = defineEmits(['complete']);
const props = defineProps(['currentDate']);

const df = new DateFormatter("en-US", {
  dateStyle: "long",
})

// No "reset completed deadlines" option: the v2 engine records a fulfilment as an
// event carrying the date it actually happened, so replaying against a new trigger
// date leaves those alone by design. The switch that used to sit here was never
// read by the server, so it silently did nothing.
const formSchema = toTypedSchema(z.object({
  date: z
    .string()
    .refine(v => v, { message: "A trigger date is required." }),
}));

const placeholder = ref()

// PocketBase stores dates as "2026-03-02 00:00:00.000Z" — a SPACE, not a "T". The
// old `split('T')[0]` therefore returned the whole string and parseDate threw
// "Invalid ISO 8601 date string", killing the form's render the moment it was
// opened on a matter that had a date. Take the first 10 characters instead, which
// is correct for both separators.
const isoDay = (d?: string) => (d ? String(d).slice(0, 10) : undefined);

const { handleSubmit, setFieldValue, values } = useForm({
  validationSchema: formSchema,
  initialValues: {
    date: isoDay(props.currentDate),
  },
})

const value = computed({
  get: () => (values.date ? parseDate(isoDay(values.date)!) : undefined),
  set: val => val,
})

const onSubmit = handleSubmit((values) => {
    emits('complete', values);
});

</script>

<template>
  <form class="space-y-8" @submit="onSubmit">
    <FormField name="date">
      <FormItem class="flex flex-col">
        <FormLabel>Enter Date</FormLabel>
        <Popover>
          <PopoverTrigger as-child>
            <FormControl>
              <Button
                variant="outline" :class="cn(
                  'w-full ps-3 text-start font-normal',
                  !value && 'text-muted-foreground',
                )"
              >
                <span>{{ value ? df.format(toDate(value)) : "Pick a date" }}</span>
                <CalendarIcon class="ms-auto h-4 w-4 opacity-50" />
              </Button>
              <input hidden>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar
              v-model:placeholder="placeholder"
              :model-value="value"
              calendar-label="Trigger Date"
              initial-focus
              :min-value="new CalendarDate(1900, 1, 1)"
              @update:model-value="(v) => {
                if (v) {
                  setFieldValue('date', v.toString())
                }
                else {
                  setFieldValue('date', undefined)
                }
              }"
            />
          </PopoverContent>
        </Popover>
        <FormDescription>
          Changing the trigger date will recalculate all deadlines for this matter.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <p class="text-xs text-muted-foreground">
      Deadlines you have already completed keep the dates you recorded — those are
      facts, not calculations. Everything still outstanding is recomputed from the
      new date.
    </p>

    <Button type="submit">
      Update Trigger Date
    </Button>
  </form>
</template>
