<template>
    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
        <DialogTrigger :as-child="true" :disabled="!usePlanActive()?.value?.active || useNetwork().isOffline.value" class="disabled:opacity-70">
            <slot />
        </DialogTrigger>

        <DialogContent side="bottom">
            <DialogHeader>
                <DialogTitle>Complete this step</DialogTitle>
                <DialogDescription>
                    {{ deadline.input_prompt }}
                </DialogDescription>
            </DialogHeader>

            <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto p-3">
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

                <SharedDeadlineCompleteDeadlineEvidenceCapture
                    v-if="matterId"
                    v-model="evidence"
                    :matter-id="matterId"
                    :deadline-id="deadline?.id" />
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
        <SheetTrigger :as-child="true" :disabled="!usePlanActive()?.value?.active || useNetwork().isOffline.value" class="disabled:opacity-70">
            <slot />
        </SheetTrigger>

        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Complete this step</SheetTitle>
                <SheetDescription>
                    {{ deadline.input_prompt }}
                </SheetDescription>
            </SheetHeader>

            <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto p-3">
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

                <SharedDeadlineCompleteDeadlineEvidenceCapture
                    v-if="matterId"
                    v-model="evidence"
                    :matter-id="matterId"
                    :deadline-id="deadline?.id" />
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
import { updateDeadline, fulfillDeadline, resetDeadline as resetDeadlineService, usableEvidence, type DeadlineEvidenceInput } from '~/services/matters';
import { Loader, CalendarIcon, TriangleAlert } from 'lucide-vue-next';
import { Calendar } from '~/components/ui/calendar';
import { cn } from '~/lib/utils';
import { getSignedInUser } from '~/services/auth';
import {toDate} from "reka-ui/date";

const props = defineProps(['deadline', 'index']);
const emits = defineEmits(['updated']);


const dateValue = ref(
    props.deadline?.date && props.deadline?.status === "fulfilled" ? parseDate(props.deadline.date.slice(0, 10)) : today('utc')
) as Ref<DateValue>;
const loading = ref(false);
// Openable from outside as well as by its own trigger: `defineModel` keeps a local
// value when no parent binds it, so every existing `<slot>`-triggered usage is
// unchanged, while a context menu can open this dialog with `v-model:open` and no
// button to click.
const open = defineModel('open', { default: false });

// Evidence is captured alongside the date and posted with it, so a completion
// and its proof land in one transaction — or neither does.
const evidence = ref<DeadlineEvidenceInput[]>([]);
const matterId = computed(() => props.deadline?.matter || '');

// Discard a half-filled draft when the dialog is dismissed, so reopening does
// not silently re-offer proof the user chose not to record.
watch(open, (isOpen) => { if (!isOpen) evidence.value = []; });

const df = new DateFormatter("en-US", {
    dateStyle: "long",
});

const _fulfillDeadline = async () => {
    loading.value = true;
    try {
        const attached = usableEvidence(evidence.value);
        await fulfillDeadline(props.deadline, toDate(dateValue.value, 'utc').toISOString().split('T')[0], attached);
        umTrackEvent("deadline-fulfilled", { deadline: props.deadline, evidence: attached.length })

        open.value = false;
        toast.success(attached.length
            ? `Completed, with ${attached.length} ${attached.length === 1 ? 'attachment' : 'attachments'}.`
            : "Successfully updated deadline!");
        emits("updated");
    } catch (e: any) {
        // The server's own words: its refusals name the artefact and the reason.
        toast.error(e?.message || 'We were unable to update your deadline!');
        console.error(e);
    }
    loading.value = false;
}

const resetDeadline = async () => {
  loading.value = true;
  try {
    // Use the dedicated reset endpoint
    await resetDeadlineService(props.deadline?.id);

    open.value = false;
    toast.success("Successfully reset deadline!");
    emits("updated");
  } catch (e) {
    toast.error('We were unable to reset your deadline!');
    console.error(e);
  }
  loading.value = false;
}
</script>