<template>
    <div v-if="noSheet" class="flex flex-col w-full h-full">
        <div class="flex flex-col w-full h-full">
            <div class="flex text-left flex-row border-y w-full p-3 gap-3"
                :class="accentClasses(index, deadline?.completed)">
                <CalendarIcon class="size-4" />

                <div class="flex flex-col gap-1">
                    <span class="font-semibold text-sm">{{ deadline.name }}</span>
                    <span class="text-sm font-semibold">
                        {{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY") }}
                    </span>

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

            <div class="flex flex-col gap-1 p-3">
                <span class="font-semibold">Description</span>
                <span>{{ deadline.description }}</span>
            </div>
        </div>

        <div class="flex flex-col gap-3 p-3">
            <SharedDeadlineCompleteDeadline v-if="deadline.dynamic" :deadline="deadline" :index="index"
                @updated="handleUpdate">
                <Button v-if="!deadline.completed" class="w-full" :class="badgeAccentClasses(index)">
                    {{ deadline?.action }}
                </Button>
                <Button v-else variant="secondary" class="w-full" :disabled="true">
                    Deadline Completed!
                </Button>
            </SharedDeadlineCompleteDeadline>

            <SharedDeadlineEditDeadline :deadline="deadline" :index="index">
                <Button class="w-full">Edit Deadline</Button>
            </SharedDeadlineEditDeadline>
        </div>
    </div>
    <Sheet v-else :modal="true" v-model:open="open">
        <SheetTrigger :as-child="true">
            <slot />
        </SheetTrigger>

        <SheetContent :hide-block="true" class="w-screen">
            <SheetHeader>
                <SheetTitle>Deadline</SheetTitle>
            </SheetHeader>

            <div class="flex flex-col">
                <div class="flex text-left flex-row border-y w-full p-3 gap-3"
                    :class="accentClasses(index, deadline?.completed)">
                    <CalendarIcon class="size-4" />

                    <div class="flex flex-col gap-1">
                        <span class="font-semibold text-sm">{{ deadline.name }}</span>
                        <span class="text-sm font-semibold">
                            {{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY") }}
                        </span>

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

                <div class="flex flex-col gap-1 p-3">
                    <span class="font-semibold">Description</span>
                    <span>{{ deadline.description }}</span>
                </div>
            </div>

            <SheetFooter>
                <SharedDeadlineCompleteDeadline v-if="deadline.dynamic" :deadline="deadline" :index="index"
                    @updated="handleUpdate">
                    <Button v-if="!deadline.completed" class="w-full" :class="badgeAccentClasses(index)">
                        {{ deadline?.action }}
                    </Button>
                    <Button v-else variant="secondary" class="w-full" :disabled="true">
                        Deadline Completed!
                    </Button>
                </SharedDeadlineCompleteDeadline>

                <SharedDeadlineEditDeadline :deadline="deadline" :index="index">
                    <Button class="w-full">Edit Deadline</Button>
                </SharedDeadlineEditDeadline>

                <SheetClose class="w-full">
                    <Button class="w-full" variant="secondary">Cancel</Button>
                </SheetClose>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { CalendarIcon, CheckCircle, Clock, XCircle } from 'lucide-vue-next';

dayjs.extend(relativeTime);

const props = defineProps(['deadline', 'index', 'noSheet']);
const emits = defineEmits(['updated']);

const open = ref(false);

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

const handleUpdate = () => {
    open.value = false;
    emits('updated');
}
</script>