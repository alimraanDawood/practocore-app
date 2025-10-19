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

const df = new DateFormatter("en-US", {
  dateStyle: "long",
})

const formSchema = toTypedSchema(z.object({
  to: z
    .string()
    .refine(v => v, { message: "An adjournment date is required." }),
    reason: z.string()
}));

const placeholder = ref()

const { handleSubmit, setFieldValue, values } = useForm({
  validationSchema: formSchema,
  initialValues: {
  },
})

const value = computed({
  get: () => values.to ? parseDate(values.to) : undefined,
  set: val => val,
})

const onSubmit = handleSubmit((values) => {
    emits('complete', values);
});

</script>

<template>
  <form class="space-y-8" @submit="onSubmit">
    <FormField name="to">
      <FormItem class="flex flex-col">
        <FormLabel>Adjournment Date</FormLabel>
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
              calendar-label="Adjournment Date"
              initial-focus
              :min-value="new CalendarDate(1900, 1, 1)"
              @update:model-value="(v) => {
                if (v) {
                  setFieldValue('to', v.toString())
                }
                else {
                  setFieldValue('to', undefined)
                }
              }"
            />
          </PopoverContent>
        </Popover>
        <!-- <FormDescription>
          Your date of birth is used to calculate your age.
        </FormDescription> -->
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField name="reason" v-slot="{ componentField }">
        <FormItem>
            <FormLabel>Reason for Adjournment</FormLabel>
            <FormControl>
                <Input placeholder="Enter reason" v-bind="componentField" />
            </FormControl>
            <FormMessage />
        </FormItem>
    </FormField>
    <Button type="submit">
      Submit
    </Button>
  </Form>
</template>