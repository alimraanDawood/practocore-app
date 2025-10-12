<template>
    <div class="flex flex-col gap-5 p-3 lg:p-5 lg:w-[95vw] w-full h-full overflow-y-scroll">
        <div class="flex flex-col gap-3.5 lg:flex-row justify-between">
            <div class="lg:flex flex-col hidden">
                <span class=" text-xl lg:text-2xl font-semibold">{{ welcomeMessage }}, {{ getSignedInUser().name.split(" ").at(0)
                    }}</span>
                <span>Welcome to PractoCore, Your litigation deadline expert</span>
            </div>

            <div class="flex flex-col lg:flex-row gap-3">
                <div class="flex flex-col p-3 border bg-background">
                    <span class="text-lg font-medium">100</span>
                    <span class="text-xs">Completed Deadlines</span>
                </div>

                <div class="flex flex-col p-3 border bg-background">
                    <span class="text-lg font-medium">32</span>
                    <span class="text-xs">Active Deadlines</span>
                </div>

                <div class="flex flex-col p-3 border bg-background">
                    <span class="text-lg font-medium">10</span>
                    <span class="text-xs">Missed Deadlines</span>
                </div>
            </div>
        </div>

        <div class="flex flex-col gap-2 bg-primary/10 p-3 rounded">
            <div class="flex flex-row gap-2 font-semibold items-center">
                <Badge>New</Badge>

                Feature Discussion

                <Button variant="ghost" size="icon" class="ml-auto"><X /></Button>
            </div>

            <span class="text-sm">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Numquam eos excepturi non
                saepe, tempora corporis neque, obcaecati illo recusandae nulla laudantium consequatur. Optio, eveniet
                iusto?</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div class="flex flex-col lg:col-span-3 gap-3">
                <div class="flex flex-row justify-between">
                    <div class="flex flex-row gap-1 items-center">
                        <span class="font-semibold">Upcoming Deadlines</span>

                        <Button size="icon" class="size-7" variant="ghost">
                            <Info />
                        </Button>
                    </div>

                    <Button class="" size="sm" variant=secondary>View All</Button>
                </div>

                <div class="flex flex-col border bg-muted divide-y overflow-hidden rounded-xl">
                    <div v-for="i in 4" class="flex flex-col lg:flex-row lg:items-center h-full justify-between">
                        <div class="flex flex-col p-3 ">
                            <span class="font-semibold text-sm text-muted-foreground">Deadline</span>
                            <span class="font-medium text-lg">Project Name</span>
                        </div>

                        <div class="flex flex-row h-full items-center">
                            <div class="flex flex-col p-3 px-5 h-full justify-center">
                                <span class="font-semibold text-sm text-muted-foreground">Events</span>
                                <div class="flex flex-row gap-1 items-center">
                                    <CalendarIcon class="size-4" />
                                    <span class="font-medium text-sm">5 events</span>
                                </div>
                            </div>

                            <div class="flex flex-col p-3 px-5 h-full justify-center">
                                <span class="font-semibold text-sm text-muted-foreground">Completion</span>
                                <div class="flex flex-row gap-1 items-center">
                                    <CalendarIcon class="size-4" />
                                    <span class="font-medium text-sm">5 events</span>
                                </div>
                            </div>

                            <div class="flex flex-col p-3 px-5 h-full justify-center">
                                <span class="font-semibold text-sm text-muted-foreground">Next Deadline</span>
                                <div class="flex flex-row gap-1 items-center">
                                    <Clock class="size-4" />
                                    <span class="font-medium text-sm">5 days</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col lg:col-span-1 gap-3">
                <div class="flex flex-row justify-between">
                    <div class="flex flex-row gap-1 items-center">
                        <span class="font-semibold">Your Calendar</span>
    
                        <Button size="icon" class="size-7" variant="ghost">
                            <Info />
                        </Button>
                    </div>

                    <Button class="" size="sm" variant=secondary>Details</Button>
                </div>

                <div class="flex flex-col border p-2 rounded-xl">
                    <Calendar />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ArrowRight, Info, CalendarIcon, Clock, X } from 'lucide-vue-next';
import { getSignedInUser } from '~/services/auth';

const hours = new Date().getHours();

const welcomeMessage = computed(() => {
    if (hours < 12) return 'Good Morning';
    if (hours < 18) return 'Good Afternoon';
    return 'Good Evening';
});
</script>