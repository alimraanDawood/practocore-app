<template>
    <CreateTemplate>
        <div class="flex flex-col p-3 w-full">
            <OverrideForm
                v-if="loading === false"
                :computed-date="deadline?.date"
                @complete="correctDeadlineDate"
            />
            <div v-else class="grid place-items-center h-32 w-full">
                <LoaderIcon class="size-5 animate-spin" />
            </div>
        </div>
    </CreateTemplate>

    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
        <DialogTrigger :disabled="!usePlanActive()?.value?.active || useNetwork().isOffline.value" class="disabled:opacity-70">
            <slot />
        </DialogTrigger>

        <DialogContent>
            <DialogHeader>
                <DialogTitle>Correct Date</DialogTitle>
            </DialogHeader>

            <ReuseTemplate />
        </DialogContent>
    </Dialog>

    <Sheet v-else v-model:open="open">
        <SheetTrigger :disabled="!usePlanActive()?.value?.active || useNetwork().isOffline.value" class="disabled:opacity-70">
            <slot />
        </SheetTrigger>

        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Correct Date</SheetTitle>
            </SheetHeader>

            <ReuseTemplate />
        </SheetContent>
    </Sheet>
</template>

<script setup>
// L2 — record that a computed date is simply not the real date.
//
// Deliberately a SEPARATE entry point from Adjourn rather than a checkbox inside
// it. The two are different events in the file: one says the court moved a date,
// the other says our calculation was wrong. Collapsing them into one dialog is
// how a firm ends up with adjournments it never had.
import { toast } from 'vue-sonner';
import OverrideForm from './OverrideForm.vue';
import { overrideDeadline } from '~/services/matters';
import { LoaderIcon } from 'lucide-vue-next';

const [CreateTemplate, ReuseTemplate] = createReusableTemplate();
const open = ref(false);
const loading = ref(false);
const emits = defineEmits(['updated']);
const props = defineProps(['deadline']);

const correctDeadlineDate = async (values) => {
    loading.value = true;
    try {
        const result = await overrideDeadline(props.deadline, values.to, values.reason);
        // The server rejects a blank reason and an unparseable date; surface its
        // message rather than reporting a success that did not happen.
        if (result?.error) throw new Error(result.error);

        umTrackEvent("deadline-overridden", { deadline: props.deadline, to: values?.to });

        toast.success("Date corrected.");
        emits('updated');
        open.value = false;
    } catch (e) {
        console.error(e);
        toast.error(e?.message || "We were unable to correct this date.");
    }
    loading.value = false;
}
</script>
