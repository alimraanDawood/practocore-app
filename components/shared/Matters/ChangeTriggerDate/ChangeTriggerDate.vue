<template>
    <CreateTemplate>
        <div class="flex flex-col p-3 w-full">
            <ChangeTriggerDateForm
                v-if="loading === false"
                :current-date="matter?.date"
                @complete="updateTriggerDate"
            />
            <div v-else class="grid place-items-center h-32 w-full">
                <LoaderIcon class="size-5 animate-spin" />
            </div>
        </div>
    </CreateTemplate>

    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
        <DialogTrigger>
            <slot />
        </DialogTrigger>

        <DialogContent>
            <DialogHeader>
                <DialogTitle>{{ matter?.triggerDatePrompt }}</DialogTitle>
                <DialogDescription>
                    This will recalculate all active deadlines for this matter based on the new trigger date.
                </DialogDescription>
            </DialogHeader>

            <ReuseTemplate />
        </DialogContent>
    </Dialog>

    <Sheet v-else v-model:open="open">
        <SheetTrigger>
            <slot />
        </SheetTrigger>

        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>{{ matter?.triggerDatePrompt }}</SheetTitle>
                <SheetDescription>
                    This will recalculate all active deadlines for this matter based on the new trigger date.
                </SheetDescription>
            </SheetHeader>

            <ReuseTemplate />
        </SheetContent>
    </Sheet>

</template>

<script setup>
import { toast } from 'vue-sonner';
import ChangeTriggerDateForm from './ChangeTriggerDateForm.vue';
import { changeMatterTriggerDate } from '~/services/matters';
import { LoaderIcon } from 'lucide-vue-next';

const [CreateTemplate, ReuseTemplate] = createReusableTemplate();
const open = ref(false);
const loading = ref(false);
const emits = defineEmits(['updated']);
const props = defineProps(['matter']);

const updateTriggerDate = async (values) => {
    loading.value = true;
    try {
        const result = await changeMatterTriggerDate(props?.matter?.id, values?.date, values?.reset_completed);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Trigger date updated successfully!", {
                description: `${result.updatedDeadlines} deadlines recalculated`
            });
            emits('updated');
            open.value = false; // close the dialog / sheet
        }
    } catch(e) {
        console.error(e);
        toast.error("We were unable to update the trigger date!")
    }
    loading.value = false;
}
</script>
