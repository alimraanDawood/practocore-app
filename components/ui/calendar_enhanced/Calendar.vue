<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { CalendarRoot, type CalendarRootEmits, type CalendarRootProps, type DateValue, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import { CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridHead, CalendarGridRow, CalendarHeadCell, CalendarHeader, CalendarHeading, CalendarNextButton, CalendarPrevButton } from '.'
import dayjs from 'dayjs';

import { parseDate } from "@internationalized/date"
import { Check } from 'lucide-vue-next'

const props = defineProps<CalendarRootProps & { class?: HTMLAttributes['class'], highlights?: { id: string, date: string, class: HTMLAttributes['class'], completed: boolean, index: number }[] }>()
const emits = defineEmits<CalendarRootEmits & { highlightClicked: [id: string] }>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

function getHighlightClass(weekDate: DateValue) {
  if (!props.highlights) return ''
  const highlight = getHighlight(weekDate);
  return highlight ? highlight.class : ''
}

function isHighlighted(weekDate : DateValue) {
  if (!props.highlights) return ''
  const highlight = getHighlight(weekDate);
  return highlight ? true : false;
}

function emitHighlightedClicked(weekDate: DateValue) {
  if (!props.highlights) return
  const highlight = getHighlight(weekDate);
  if (highlight) {
    emits('highlightClicked', highlight.id)
  }
}

function getHighlight(weekDate : DateValue) {
  if (!props.highlights) return
  const highlight = props.highlights.find(h => weekDate.toString() === parseDate(h?.date?.slice(0, 10)).toString());
  return highlight;
}

const accentClasses = (accentIndex : number) : string => {
    const accentMap : Object = {
        0: 'bg-accent-1 text-accents-foreground',
        1: 'bg-accent-2 text-accents-foreground',
        2: 'bg-accent-3 text-accents-foreground',
        3: 'bg-accent-4 text-accents-foreground'
    };
    return accentMap[accentIndex % 4];
};
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    data-slot="calendar"
    :class="cn('p-3', props.class)"
    v-bind="forwarded"
  >
    <CalendarHeader>
      <CalendarHeading />

      <div class="flex items-center gap-1">
        <CalendarPrevButton />
        <CalendarNextButton />
      </div>
    </CalendarHeader>

    <div class="flex flex-col  gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid  v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead >
          <CalendarGridRow>
            <CalendarHeadCell class="w-full"
              v-for="day in weekDays" :key="day"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
            <CalendarCell class="w-full aspect-square"
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <CalendarCellTrigger
                v-if="isHighlighted(weekDate)"
                :class="cn('relative', getHighlightClass(weekDate))"
                @click="emitHighlightedClicked(weekDate)"
                :override-click="true"
                :day="weekDate"
                :month="month.value"
              >
              {{ weekDate.day }}
              <div v-if="getHighlight(weekDate)?.completed" class="size-4 absolute top-[-50%] grid place-items-center translate-y-[50%] right-[-50%] translate-x-[-50%] rounded-full" :class="accentClasses(getHighlight(weekDate)?.index)">
                <Check class="size-3" />
              </div>
            </CalendarCellTrigger>
              <CalendarCellTrigger
                v-else
                :day="weekDate"
                :month="month.value"
              />              
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
