<script setup lang="ts">
import {CircleProgressBar} from 'vue3-m-circle-progress-bar';
import {ArrowRight, Info, Loader, CalendarIcon, Clock, X, XCircle, Plus, Bell} from 'lucide-vue-next';
import {getSignedInUser} from '~/services/auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';
import {storeToRefs} from 'pinia';
import {useDashboardStore} from '~/stores/dashboard';
import {TourGuideManager, type TourGuideStep} from "v-tour-guide";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);


const hours = new Date().getHours();
const dashboard = useDashboardStore();
const {statistics, loading} = storeToRefs(dashboard);

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

// Optional: Add listener for notification actions
onMounted(() => {
  if (!hasCompletedTour()) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      welcomeTourGuide.value?.startTourGuide();
    }, 500);
  }
});

onUnmounted(() => {
});


const welcomeTourGuide = ref<InstanceType<typeof TourGuideManager>>();

const restartTour = () => {
  welcomeTourGuide.value?.startTourGuide();
}
// Tour configuration
const TOUR_STORAGE_KEY = 'practocore_welcome_tour_completed';

// Check if user has completed the tour
const hasCompletedTour = () => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
}

const markTourCompleted = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }
}

// Shared tooltip styling
const tooltipStyle = {
  backgroundColor: "var(--color-background)",
  textColor: "var(--color-foreground)",
  buttonBackgroundColor: "var(--color-muted)",
  buttonTextColor: "var(--color-muted-foreground)",
  skipButtonColor: "var(--color-primary)",
};

const tourSteps: TourGuideStep[] = [
  {
    id: 'statistics',
    target: 'statistics',
    title: 'Your Dashboard at a Glance',
    content: 'Track your progress here. See how many deadlines you\'ve completed, what\'s currently active, and if anything needs urgent attention.',
    showAction: true,
    tooltip: tooltipStyle
  },
  {
    id: 'upcoming',
    target: 'upcoming',
    title: 'Stay Ahead of Your Deadlines',
    content: 'Your most urgent matters appear here first. Click any matter to see all its deadlines and take action before time runs out.',
    showAction: true,
    tooltip: tooltipStyle
  },
  {
    id: 'calendar',
    target: 'calendar',
    title: 'Plan Your Week',
    content: 'Spot busy days at a glance. Dates with multiple deadlines are highlighted so you can plan ahead and avoid last-minute surprises.',
    showAction: true,
    tooltip: tooltipStyle
  },
  {
    id: 'create-matter',
    target: 'create-matter',
    title: 'Ready to Get Started?',
    content: 'Click here to create your first matter. PractoCore will automatically calculate all your deadlines based on your jurisdiction\'s rules.',
    showAction: true,
    tooltip: tooltipStyle
  },
]

// Handle tour completion
const onTourComplete = () => {
  markTourCompleted();
}

</script>

<template>
  <div class="flex flex-col w-full h-full items-center overflow-hidden">
    <TourGuideManager ref="welcomeTourGuide" :steps="tourSteps" @complete="onTourComplete" @skip="onTourComplete"/>

    <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
      <div class="flex flex-col">
        <span class="text-sm text-muted-foreground">{{ welcomeMessage }}</span>
        <span class="font-medium">{{ getSignedInUser()?.name }}</span>
      </div>

      <div class="flex flex-row items-center gap-2">
        <SharedDarkModeSwitch/>

        <SharedNotifications>
          <Button size="icon" variant="secondary">
            <Bell/>
          </Button>
        </SharedNotifications>
        <SharedProfile/>
      </div>
    </div>

    <div class="flex flex-col lg:w-[95vw] w-full h-full overflow-y-scroll lg:overflow-y-hidden border-x">
      <div class="flex flex-col gap-3.5 p-3 lg:p-5 lg:flex-row lg:items-center justify-between border-b">
        <div class="xs:flex flex-col hidden">
          <span class=" text-xl lg:text-2xl font-semibold ibm-plex-serif">{{
              welcomeMessage
            }}, {{ getSignedInUser().name.split(" ").at(0) }}</span>
          <span>Welcome to PractoCore, Your Litigation Deadline Management Expert</span>
        </div>

        <div data-tour-guide="statistics" class="flex flex-col xs:grid xs:grid-cols-2 lg:flex lg:flex-row gap-3">
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

      <div class="grid grid-cols-1 lg:grid-cols-4 h-full">
        <div class="flex flex-col lg:col-span-3 border-r p-3 gap-3">
          <div class="flex flex-row justify-between">
            <div class="flex flex-row gap-1 items-center">
              <span class="font-semibold ibm-plex-sans">Upcoming Deadlines</span>

              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button size="icon" class="size-7" variant="ghost">
                    <Info/>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem @click="restartTour" class="cursor-pointer">
                    Take a tour
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <SharedMattersCreateMatter data-tour-guide="create-matter" @created="reloadStatistics"
                                       v-if="statistics?.matters?.length === 0">
              <Button>
                <Plus/>

                Create Matter
              </Button>
            </SharedMattersCreateMatter>
            <div class="flex flex-row items-center gap-2" v-else>
              <NuxtLink to="/main/matters">
                <Button class="" size="sm" variant=secondary>View All</Button>
              </NuxtLink>

              <SharedMattersCreateMatter @created="reloadStatistics">
                <Button data-tour-guide="create-matter" size="icon-sm">
                  <Plus/>
                </Button>
              </SharedMattersCreateMatter>
            </div>
          </div>

          <XyzTransition data-tour-guide="upcoming" xyz="fade" mode="out-in">
            <div v-if="loading"
                 class="flex flex-col h-32 w-full bg-muted border rounded-xl place-items-center justify-center">
              <Loader class="size-5 animate-spin"/>
            </div>

            <div v-else-if="statistics?.matters?.length > 0"
                 class="flex flex-col border bg-muted divide-y overflow-hidden rounded-xl">
              <NuxtLink v-for="matter in statistics?.matters" :to="`/main/matters/matter/${matter?.id}`">
                <div
                    class="flex flex-col lg:flex-row lg:items-center h-full justify-between hover:bg-muted hover:text-primary transition-colors ease-in-out duration-500">
                  <div class="flex flex-col p-3 w-full">
                    <div class="flex flex-row gap-1 items-center">
                      <span class="font-semibold text-sm text-muted-foreground">Matter</span>
                      <div class="size-1 rounded-full bg-muted-foreground"></div>
                      <span class="font-semibold text-sm text-muted-foreground">{{ matter?.caseNumber }}</span>
                    </div>
                    <span class="font-medium text-lg">{{ matter?.name }}</span>
                  </div>

                  <div class="flex flex-col lg:flex-row h-full w-full lg:items-center">
                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                      <span class="font-semibold text-sm text-muted-foreground">Events</span>
                      <div class="flex flex-row gap-1 items-center">
                        <CalendarIcon class="size-4"/>
                        <span class="font-medium text-sm">{{ matter?.stats?.upcoming }} events</span>
                      </div>
                    </div>

                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                      <span class="font-semibold text-sm text-muted-foreground">Completion</span>
                      <div v-if="matter?.stats?.completion > 0" class="flex flex-row gap-1 items-center">
                        <CircleProgressBar :value="matter?.stats?.completion" :max="100" rounded
                                           class="size-4" strokeWidth="10"/>
                        <span class="font-medium text-sm">{{ matter?.stats?.completion }}</span>
                      </div>
                      <span v-else>-</span>
                    </div>

                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                      <span class="font-semibold text-sm text-muted-foreground">Next Deadline</span>
                      <div class="flex flex-row gap-1 items-center" :class="{
                                              'text-red-500 !font-semibold': matter?.stats?.nextDeadlineDate &&
                                                  dayjs(matter?.stats?.nextDeadlineDate).diff(dayjs(), 'day') < 5
                                          }">
                        <Clock class="size-4"/>
                        <span v-if="matter" class="font-medium text-sm">
                                                  {{ dayjs(matter?.stats?.nextDeadlineDate).fromNow() }}
                                              </span>
                      </div>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>

            <div v-else
                 class="flex flex-col w-full bg-muted border p-5 rounded-xl items-center text-muted-foreground">
              <XCircle class="size-10"/>
              <span>You have no matters</span>
              <span>Click
                            <div class="inline-block">
                                <SharedMattersCreateMatter class="w-fit inline-block">
                                    <button variant="link"
                                            class="!p-0 underline text-primary font-semibold">here</button>
                                </SharedMattersCreateMatter>
                            </div>

                              to add a deadline matter
                          </span>
            </div>
          </XyzTransition>
        </div>

        <div class="flex flex-col lg:col-span-1 p-3 gap-3">
          <div class="flex flex-row justify-between">
            <div class="flex flex-row gap-1 items-center">
              <span class="font-semibold">Your Calendar</span>

              <Button size="icon" class="size-7" variant="ghost">
                <Info/>
              </Button>
            </div>

            <NuxtLink to="/main/calendar">
              <Button class="" size="sm" variant=secondary>Details</Button>
            </NuxtLink>
          </div>

          <div data-tour-guide="calendar" class="flex flex-col border p-2 rounded-xl">
            <PageComponentsHomeEventCalendar/>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>