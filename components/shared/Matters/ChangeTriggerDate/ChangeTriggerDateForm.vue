<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone, parseDate, today } from "@internationalized/date"
import { toTypedSchema } from "@vee-validate/zod"
import { CalendarIcon } from "lucide-vue-next"
import { toDate } from "reka-ui/date"
import { useForm } from "vee-validate"
import { computed, h, ref } from "vue"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

const emits = defineEmits(['complete']);
const props = defineProps(['currentDate']);

const df = new DateFormatter("en-US", {
  dateStyle: "long",
})

const formSchema = toTypedSchema(z.object({
  date: z
    .string()
    .refine(v => v, { message: "A trigger date is required." }),
  reset_completed: z.boolean().default(false).optional(),
}));

const placeholder = ref()

const { handleSubmit, setFieldValue, values } = useForm({
  validationSchema: formSchema,
  initialValues: {
    date: props.currentDate || undefined,
    reset_completed: false
  },
})

const value = computed({
  get: () => values.date ? parseDate(values.date.split('T')[0]) : undefined,
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
        <FormLabel>New Trigger Date</FormLabel>
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

    <FormField v-slot="{ value, handleChange }" name="reset_completed">
      <FormItem class="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
        <FormControl>
          <Switch :model-value="value" @update:model-value="handleChange" />
        </FormControl>
        <div class="space-y-1 leading-none">
          <FormLabel>Reset Completed Deadlines</FormLabel>
          <FormDescription>
            If checked, completed deadlines will be un-completed and recalculated based on the new trigger date.
          </FormDescription>
        </div>
      </FormItem>
    </FormField>

    <Button type="submit">
      Update Trigger Date
    </Button>
  </form>
</template>
