<template>
    <Sheet v-model:open="open">
        <SheetTrigger :as-child="true">
            <slot />
        </SheetTrigger>

        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Enter Date</SheetTitle>
                <SheetDescription>
                    Enter Date of fulfillment of this deadline.
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
                    @click="fulfillDeadline" 
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
import { DateFormatter, getLocalTimeZone, today } from "@internationalized/date";
import { toast } from 'vue-sonner';
import { updateDeadline } from '~/services/projects';
import { Loader, CalendarIcon } from 'lucide-vue-next';
import { Calendar } from '~/components/ui/calendar';
import { cn } from '~/lib/utils';

const props = defineProps(['deadline', 'index']);
const emits = defineEmits(['updated']);

const dateValue = ref(today(getLocalTimeZone())) as Ref<DateValue>;
const loading = ref(false);
const open = ref(false);

const df = new DateFormatter("en-US", {
    dateStyle: "long",
});

const fulfillDeadline = async () => {
    loading.value = true;
    try {
        const result = await updateDeadline(
            props.deadline?.id, 
            { 
                completed: true, 
                date: dateValue.value.toDate(getLocalTimeZone()) 
            }
        );

        // open.value = false;
        toast.success("Successfully updated deadline!");
        emits('updated');
    } catch (e) {
        toast.error('We were unable to update your deadline!');
        console.error(e);
    }
    loading.value = false;
}
</script>