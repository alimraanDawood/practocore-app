<script setup lang="ts">
import { CalendarDate, DateFormatter, parseDate } from "@internationalized/date"
import { toTypedSchema } from "@vee-validate/zod"
import { CalendarIcon } from "lucide-vue-next"
import { toDate } from "reka-ui/date"
import { useForm } from "vee-validate"
import { computed, ref } from "vue"
import { z } from "zod"
import { cn } from "@/lib/utils"

const props = defineProps<{ computedDate?: string }>()
const emits = defineEmits(['complete'])

const df = new DateFormatter("en-US", { dateStyle: "long" })

// The reason is required here as well as server-side. It is the only thing that
// will later explain why this date stopped matching the rule the timeline cites,
// and a lawyer who is asked for it at the moment of the correction will actually
// have it to hand.
const formSchema = toTypedSchema(z.object({
  to: z.string().refine(v => v, { message: "The actual date is required." }),
  reason: z.string().trim().min(3, { message: "Record why the computed date is wrong — this is the audit note." }),
}))

const placeholder = ref()
// Seeded with empty strings, not left undefined: otherwise Zod's base type check
// fires first and a lawyer is shown "Invalid input: expected string, received
// undefined" instead of the sentence we wrote.
const { handleSubmit, setFieldValue, values } = useForm({
  validationSchema: formSchema,
  initialValues: { to: '', reason: '' },
})

const value = computed({
  get: () => values.to ? parseDate(values.to) : undefined,
  set: val => val,
})

const onSubmit = handleSubmit((v) => emits('complete', v))
</script>

<template>
  <form class="space-y-6" @submit="onSubmit">
    <p class="text-sm text-muted-foreground">
      Use this when the computed date is simply not the real one. If the court moved
      the date, close this and use <span class="font-medium text-foreground">Adjourn</span> instead —
      that is recorded as an adjournment.
    </p>

    <div v-if="props.computedDate" class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <span class="text-muted-foreground">Currently computed as </span>
      <span class="font-medium">{{ df.format(toDate(parseDate(props.computedDate.slice(0, 10)))) }}</span>
    </div>

    <FormField name="to">
      <FormItem class="flex flex-col">
        <FormLabel>Actual date</FormLabel>
        <Popover>
          <PopoverTrigger as-child>
            <FormControl>
              <Button
                variant="outline" :class="cn('w-full ps-3 text-start font-normal', !value && 'text-muted-foreground')"
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
              calendar-label="Actual date"
              initial-focus
              :min-value="new CalendarDate(1900, 1, 1)"
              @update:model-value="(v) => setFieldValue('to', v ? v.toString() : undefined)"
            />
          </PopoverContent>
        </Popover>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField name="reason" v-slot="{ componentField }">
      <FormItem>
        <FormLabel>Why is the computed date wrong?</FormLabel>
        <FormControl>
          <Input placeholder="e.g. Registrar gave 14 May orally at the mention on 2 May" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Kept on the record so anyone reading the file later can see why this date
          departs from the rule.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit">Correct date</Button>
  </form>
</template>
