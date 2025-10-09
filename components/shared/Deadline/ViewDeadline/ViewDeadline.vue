<template>
    <Drawer v-model:open="open2">
        <DrawerTrigger :as-child="true">
            <slot />
        </DrawerTrigger>

        <DrawerContent :hide-block="true" class="p-0 !mt-0 !rounded-0 ring-0 outline-0 overflow-visible p-1">
            <div class="flex text-left flex-row border-2 p-3 gap-3" :class="accentClasses(index, deadline?.completed)">
                <CalendarIcon class="size-4" />

                <div class="flex flex-col gap-1">
                    <span class="font-semibold text-sm">{{ deadline.name }}</span>
                    <span class="text-sm font-semibold">{{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY")
                        }}</span>

                    <Badge v-if="deadline.completed === false && (new Date() < new Date(deadline.date))"
                        :class="badgeAccentClasses(index)">
                        <Clock /> PENDING
                    </Badge>
                    <Badge v-else-if="deadline.completed === false && (new Date() > new Date(deadline.date))"
                        :class="badgeAccentClasses(index)">
                        <XCircle /> MISSED
                    </Badge>
                    <Badge v-else-if="deadline.completed === true" :class="badgeAccentClasses(index)">
                        <CheckCircle /> COMPLETED
                    </Badge>
                </div>
            </div>

            <DrawerFooter v-model:open="open2">
                <Drawer v-if="deadline.dynamic">
                    <DrawerTrigger :as-child="true">
                        <Button v-if="!deadline.completed" :class="badgeAccentClasses(index)">{{ deadline?.action
                            }}</Button>
                        <Button v-else variant="secondary" :disabled="true">Deadline Completed!</Button>
                    </DrawerTrigger>

                    <DrawerContent>
                        <DrawerHeader>
                            <DrawerTitle>
                                Enter Date
                            </DrawerTitle>

                            <DrawerDescription>
                                Enter Date of fulfillment of this deadline.
                            </DrawerDescription>
                        </DrawerHeader>

                        <div class="flex flex-col p-3">
                            <Popover>
                                <PopoverTrigger as-child>
                                    <Button variant="outline" :class="cn(
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


                        <DrawerFooter>
                            <Button @click="fulfillDeadline" class="disabled:opacity-50" :disabled="loading">
                                <span v-if="!loading">Use Date</span>
                                <Loader v-else class="animate-spin" />
                            </Button>
                            <DialogClose class="w-full">
                                <Button class="w-full" variant="secondary">Cancel</Button>
                            </DialogClose>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>

                <SharedDeadlineEditDeadline :deadline="deadline" :index="index">
                    <Button class="w-full">Edit Deadline</Button>
                </SharedDeadlineEditDeadline>

                <DialogClose class="w-full">
                    <Button class="w-full" variant="secondary">Cancel</Button>
                </DialogClose>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
</template>

<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { DateFormatter, getLocalTimeZone, today } from "@internationalized/date"
import { toast } from 'vue-sonner';
import { updateDeadline } from '~/services/projects';
import { Loader, CalendarIcon, CheckCircle } from 'lucide-vue-next';
import { Calendar } from '~/components/ui/calendar';
import { cn } from '~/lib/utils';


dayjs.extend(relativeTime);
const props = defineProps(['deadline', 'index']);
const emits = defineEmits(['updated']);

const dateValue = ref(today(getLocalTimeZone())) as Ref<DateValue>; // today
const loading = ref(false);
const open1 = ref(false);
const open2 = ref(false);

const df = new DateFormatter("en-US", {
  dateStyle: "long",
})

const accentClasses = (accentIndex: number) => {
    const accentMap = {
        0: 'bg-accent-1/10 text-accent-1 border-accent-1',
        1: 'bg-accent-2/10 text-accent-2 border-accent-2',
        2: 'bg-accent-3/10 text-accent-3 border-accent-3',
        3: 'bg-accent-4/10 text-accent-4 border-accent-4'
    };
    return accentMap[accentIndex % 4];
}


const badgeAccentClasses = (accentIndex: number, completed = false) => {
    const accentMap = {
        0: completed ? 'bg-accent-1/10 text-accent-1 border-2 border-accent-1' : 'bg-accent-1 !text-accents-foreground data-[selected]:!bg-accent-1 hover:bg-accent-1 data-[selected]:hover:!bg-accent-1',
        1: completed ? 'bg-accent-2/10 text-accent-2 border-2 border-accent-2' : 'bg-accent-2 !text-accents-foreground data-[selected]:!bg-accent-2 hover:bg-accent-2 data-[selected]:hover:!bg-accent-2',
        2: completed ? 'bg-accent-3/10 text-accent-3 border-2 border-accent-3' : 'bg-accent-3 !text-accents-foreground data-[selected]:!bg-accent-3 hover:bg-accent-3 data-[selected]:hover:!bg-accent-3',
        3: completed ? 'bg-accent-4/10 text-accent-4 border-2 border-accent-4' : 'bg-accent-4 !text-accents-foreground data-[selected]:!bg-accent-4 hover:bg-accent-4 data-[selected]:hover:!bg-accent-4'
    };

    return accentMap[accentIndex % 4];
}

const fulfillDeadline = async () => {
    loading.value = true;
    try {
        const result = await updateDeadline(props.deadline?.id, { completed: true, date: dateValue.value.toDate(getLocalTimeZone()) });

        open1.value, open2.value = false; // close all dialogs
        toast.success("Successfully updated deadline!");

        emits('updated');
    } catch (e) {
        toast.error('We were unable to update your deadline!')
        console.error(e);
    }
    loading.value = false;
}
</script>