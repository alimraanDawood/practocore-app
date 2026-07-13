<template>
    <CreateTemplate>
        <div class="flex flex-col p-3 w-full">
            <ChangeTriggerDateForm
                v-if="loading === false"
                :current-date="matter?.date || matter?.triggerDate"
                @complete="confirm"
            />
            <div v-else class="grid place-items-center h-32 w-full">
                <LoaderIcon class="size-5 animate-spin" />
            </div>
        </div>
    </CreateTemplate>

    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
        <DialogTrigger :disabled="!usePlanActive()?.value?.active" class="disabled:opacity-70">
            <slot />
        </DialogTrigger>

        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm trigger date</DialogTitle>
                <DialogDescription>
                    This pins the real trigger date and switches the projected timeline live.
                    Deadlines and reminders will start firing from this date.
                </DialogDescription>
            </DialogHeader>

            <ReuseTemplate />
        </DialogContent>
    </Dialog>

    <Sheet v-else v-model:open="open">
        <SheetTrigger :disabled="!usePlanActive()?.value?.active" class="disabled:opacity-70">
            <slot />
        </SheetTrigger>

        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Confirm trigger date</SheetTitle>
                <SheetDescription>
                    This pins the real trigger date and switches the projected timeline live.
                    Deadlines and reminders will start firing from this date.
                </SheetDescription>
            </SheetHeader>

            <ReuseTemplate />
        </SheetContent>
    </Sheet>
</template>

<script setup>
import { toast } from 'vue-sonner';
import ChangeTriggerDateForm from './ChangeTriggerDateForm.vue';
import { confirmTriggerDate } from '~/services/matters';
import { LoaderIcon } from 'lucide-vue-next';

const [CreateTemplate, ReuseTemplate] = createReusableTemplate();
const open = ref(false);
const loading = ref(false);
const emits = defineEmits(['updated']);
const props = defineProps(['matter']);

const confirm = async (values) => {
    loading.value = true;
    try {
        const result = await confirmTriggerDate(props?.matter?.id, values?.date);
        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success("Timeline confirmed — deadlines and reminders are now live.");
            emits('updated');
            open.value = false;
        }
    } catch (e) {
        console.error(e);
        toast.error("We were unable to confirm the trigger date.");
    }
    loading.value = false;
}
</script>
