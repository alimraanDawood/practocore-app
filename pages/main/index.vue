<template>
    <div class="flex flex-col gap-5 p-3 lg:p-5 lg:w-[95vw] w-full h-full overflow-y-scroll">

        <div class="flex flex-col gap-3.5 lg:flex-row justify-between">
            <div class="lg:flex flex-col hidden">
                <span class=" text-xl lg:text-2xl font-semibold">{{ welcomeMessage }}, {{ getSignedInUser().name.split(" ").at(0) }}</span>
                <span>Welcome to PractoCore, Your litigation deadline expert</span>
            </div>

            <div class="flex flex-col lg:flex-row gap-3">
                <div class="flex flex-col p-3 border bg-background">
                    <span class="text-lg font-medium">{{ statistics?.completedDeadlines }}</span>
                    <span class="text-xs">Completed Deadlines</span>
                </div>

                <div class="flex flex-col p-3 border bg-background">
                    <span class="text-lg font-medium">{{ statistics?.activeDeadlines }}</span>
                    <span class="text-xs">Active Deadlines</span>
                </div>

                <div class="flex flex-col p-3 border bg-background">
                    <span class="text-lg font-medium">{{ statistics?.missedDeadlines }}</span>
                    <span class="text-xs">Missed Deadlines</span>
                </div>
            </div>
        </div>

        <div class="hidden  flex-col gap-2 bg-primary/10 p-3 rounded">
            <div class="flex flex-row gap-2 font-semibold items-center">
                <Badge>New</Badge>

                Feature Discussion

                <Button variant="ghost" size="icon" class="ml-auto">
                    <X />
                </Button>
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

                    <SharedProjectsCreateProject v-if="statistics?.projects?.length === 0">
                        <Button>
                            <Plus />

                            Create Project
                        </Button>
                    </SharedProjectsCreateProject>
                    <NuxtLink v-else to="/main/projects">
                        <Button class="" size="sm" variant=secondary>View All</Button>
                    </NuxtLink>
                </div>

                <XyzTransition xyz="fade" mode="out-in">
                    <div v-if="loading" class="flex flex-col h-32 w-full bg-muted border rounded-xl place-items-center justify-center">
                        <Loader class="size-5 animate-spin" />
                    </div>
    
                    <div v-else-if="statistics?.projects?.length > 0"
                        class="flex flex-col border bg-muted divide-y overflow-hidden rounded-xl">
                        <NuxtLink v-for="project in statistics?.projects" :to="`/main/projects/project/${project.id}`">
                            <div class="flex flex-col lg:flex-row lg:items-center h-full justify-between">
                                <div class="flex flex-col p-3 ">
                                    <span class="font-semibold text-sm text-muted-foreground">Project</span>
                                    <span class="font-medium text-lg">{{ project.name }}</span>
                                </div>
    
                                <div class="flex flex-col lg:flex-row h-full w-full lg:items-center">
                                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                                        <span class="font-semibold text-sm text-muted-foreground">Events</span>
                                        <div class="flex flex-row gap-1 items-center">
                                            <CalendarIcon class="size-4" />
                                            <span class="font-medium text-sm">{{ project.stats.upcoming }} events</span>
                                        </div>
                                    </div>
    
                                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                                        <span class="font-semibold text-sm text-muted-foreground">Completion</span>
                                        <div v-if="project.stats.completion > 0" class="flex flex-row gap-1 items-center">
                                            <CircleProgressBar :value="project.stats.completion" :max="100" rounded
                                                class="size-4" strokeWidth="10" />
                                            <span class="font-medium text-sm">{{ project.stats.completion }}</span>
                                        </div>
                                        <span v-else>-</span>
                                    </div>
    
                                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                                        <span class="font-semibold text-sm text-muted-foreground">Next Deadline</span>
                                        <div class="flex flex-row gap-1 items-center" :class="{
                                            'text-red-500 !font-semibold': project?.stats?.nextDeadlineDate &&
                                                dayjs(project.stats.nextDeadlineDate).diff(dayjs(), 'day') < 5
                                        }">
                                            <Clock class="size-4" />
                                            <span v-if="project" class="font-medium text-sm">
                                                {{ dayjs(project?.stats?.nextDeadlineDate).fromNow() }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </NuxtLink>
                    </div>
    
                    <div v-else
                        class="flex flex-col w-full bg-muted border p-5 rounded-xl items-center text-muted-foreground">
                        <XCircle class="size-10" />
                        <span>You have no projects</span>
                        <span>Click
                            <SharedProjectsCreateProject>
                                <button variant="link" class="!p-0 underline text-primary font-semibold">here</button>
                            </SharedProjectsCreateProject>
    
                            to add a deadline project
                        </span>
                    </div>
                </XyzTransition>
            </div>

            <div class="flex flex-col lg:col-span-1 gap-3">
                <div class="flex flex-row justify-between">
                    <div class="flex flex-row gap-1 items-center">
                        <span class="font-semibold">Your Calendar</span>

                        <Button size="icon" class="size-7" variant="ghost">
                            <Info />
                        </Button>
                    </div>

                    <NuxtLink to="/main/calendar">
                      <Button class="" size="sm" variant=secondary>Details</Button>
                    </NuxtLink>
                </div>

                <div class="flex flex-col border p-2 rounded-xl">
                    <PageComponentsHomeEventCalendar />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { CircleProgressBar } from 'vue3-m-circle-progress-bar';
import { ArrowRight, Info, Loader, CalendarIcon, Clock, X, XCircle, Plus } from 'lucide-vue-next';
import { getSignedInUser } from '~/services/auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';
import { storeToRefs } from 'pinia';
import { useDashboardStore } from '~/stores/dashboard';

 dayjs.extend(relativeTime);
 dayjs.extend(utc);
 dayjs.extend(timezone);

 const hours = new Date().getHours();
 const dashboard = useDashboardStore();
 const { statistics, loading } = storeToRefs(dashboard);

 const welcomeMessage = computed(() => {
     if (hours < 12) return 'Good Morning';
     if (hours < 18) return 'Good Afternoon';
     return 'Good Evening';
 });

 onMounted(async () => {
     await dashboard.init();
 });

 const reloadStatistics = async () => {
     await dashboard.fetchStatistics(true);
 }

</script>