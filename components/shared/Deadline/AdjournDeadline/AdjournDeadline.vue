<template>
    <CreateTemplate>
        <div class="flex flex-col p-3 w-full">
            <AdjournmentForm v-if="loading === false" @complete="createDeadlineAdjournment" />
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
                <DialogTitle>Adjourn Deadline</DialogTitle>
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
                <SheetTitle>Adjourn Deadline</SheetTitle>
            </SheetHeader>

            <ReuseTemplate />
        </SheetContent>
    </Sheet>

</template>

<script setup>
import { toast } from 'vue-sonner';
import AdjournmentForm from './AdjournmentForm.vue';
import { createAdjournment } from '~/services/matters';
import { LoaderIcon } from 'lucide-vue-next';

const [CreateTemplate, ReuseTemplate] = createReusableTemplate();
const open = ref(false);
const loading = ref(false);
const emits = defineEmits(['updated']);
const props = defineProps(['matter', 'deadline']);

const steps = computed(() => {
    if (props.deadline) {
        return [{
            step: 1,
            title: 'Details'
        },
        {
            step: 2,
            title: 'Preview'
        }]
    }

    if (props.matter) {
        return [
            {
                step: 1,
                title: 'Choose Deadline'
            },
            {
                step: 2,
                title: 'Details'
            },
            {
                step: 3,
                title: 'Preview'
            }
        ]
    }
    return [];
});

const createDeadlineAdjournment = async (values) => {
    loading.value = true;
    try {
        const result = await createAdjournment({ deadline: props?.deadline?.id, from: props?.deadline?.date, to: values?.to, reason: values?.reason });

        toast.success("Adjournment created successfully!");
        emits('updated');
        open.value = false; // close the dialog / sheet
    } catch(e) {
        console.error(e);

        toast.error("We were unable to create your adjournment!")
    }
    loading.value = false;
}
</script>