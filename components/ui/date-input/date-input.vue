<script setup lang="ts">
import {CalendarIcon} from 'lucide-vue-next'
import {computed, ref} from 'vue'
import {Button} from '@/components/ui/button'
import {Calendar} from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {cn} from '@/lib/utils'
import {
  CalendarDate,
  DateFormatter,
  parseDate,
} from "@internationalized/date";
import {toDate} from "reka-ui/date";

const df = new DateFormatter("en-US", {dateStyle: "long"});
const props = defineProps(['modelValue']);
const emits = defineEmits(['update:modelValue']);

const value = computed({
  get: () => {
    return props.modelValue ? parseDate(props.modelValue) : undefined
  },
  set: (val) => val
});
</script>

<template>
  <Popover :modal="true">
    <PopoverTrigger as-child>
      <FormControl>
        <Button
            variant="outline"
            :class="
                                cn(
                                  'w-full ps-3 text-start font-normal',
                                  !value && 'text-muted-foreground'
                                )
                              "
        >
                              <span>{{
                                  modelValue ? df.format(new Date(value)) : "Pick a date"
                                }}</span>
          <CalendarIcon
              class="ms-auto h-4 w-4 opacity-50"
          />
        </Button>
        <input hidden/>
      </FormControl>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0">
      <Calendar
          :model-value="value"
          calendar-label="Project Date"
          initial-focus
          :min-value="new CalendarDate(1900, 1, 1)"
          @update:model-value="v => {
            if(v) {
              emits('update:modelValue', v.toString());
            } else {
              emits('update:modelValue', undefined);
            }
          }"
      />
    </PopoverContent>
  </Popover>
</template>
