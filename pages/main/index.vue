<script setup lang="ts">
import {CircleProgressBar} from 'vue3-m-circle-progress-bar';
import {Info, Loader, CalendarIcon, Clock, XCircle, Plus, Bell, AlertTriangle} from 'lucide-vue-next';
import {getSignedInUser} from '~/services/auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import {storeToRefs} from 'pinia';
import {useDashboardStore} from '~/stores/dashboard';
import {useMattersStore} from '~/stores/matters';
import {TourGuideManager, type TourGuideStep} from "v-tour-guide";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const hours = new Date().getHours();
const dashboard = useDashboardStore();
const mattersStore = useMattersStore();
const {statistics, loading} = storeToRefs(dashboard);

const welcomeMessage = computed(() => {
  if (hours < 12) return 'Good Morning';
  if (hours < 18) return 'Good Afternoon';
  return 'Good Evening';
});

onMounted(async () => {
  await dashboard.init();
  if (!hasCompletedTour()) {
    await nextTick();
    welcomeTourGuide.value?.startTourGuide();
  }
});

const reloadStatistics = async (newMatter?: any) => {
  if (newMatter) {
    const matterRecord = newMatter?.matter || newMatter;
    if (matterRecord?.id) {
      mattersStore.addMatterOptimistic(matterRecord);
    } else {
      mattersStore.fetchMattersInBackground();
    }
  } else {
    mattersStore.fetchMattersInBackground();
  }
  await dashboard.fetchStatistics(true);
}

const welcomeTourGuide = ref<InstanceType<typeof TourGuideManager>>();

const restartTour = () => {
  welcomeTourGuide.value?.startTourGuide();
}

const TOUR_STORAGE_KEY = 'practocore_welcome_tour_completed';

const hasCompletedTour = () => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
}

const markTourCompleted = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }
}

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

const onTourComplete = () => {
  markTourCompleted();
}

const { hasPermission } = usePermissions()

const isUrgent = (matter: any) =>
  matter?.stats?.nextDeadlineDate &&
  dayjs(matter.stats.nextDeadlineDate).diff(dayjs(), 'day') < 5
</script>

<template>
  <div class="flex flex-col w-full h-full items-center overflow-hidden">
    <TourGuideManager ref="welcomeTourGuide" :steps="tourSteps" @complete="onTourComplete" @skip="onTourComplete"/>

    <!-- Mobile header (hidden on xs+) -->
    <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
      <div class="flex flex-col">
        <span class="text-sm text-muted-foreground">{{ welcomeMessage }}</span>
        <span class="font-medium">{{ getSignedInUser()?.name }}</span>
      </div>

      <div class="flex flex-row items-center gap-2">
        <SharedDarkModeSwitch/>

        <SharedNotifications>
          <Button size="icon" variant="secondary" aria-label="Open notifications">
            <Bell aria-hidden="true"/>
          </Button>
        </SharedNotifications>
        <SharedProfile/>
      </div>
    </div>

    <div class="flex flex-col lg:w-[95vw] w-full h-full overflow-y-auto lg:overflow-y-hidden border-x">
      <!-- Page header + stats row -->
      <div class="flex flex-col gap-3.5 p-3 lg:p-5 lg:flex-row lg:items-center justify-between border-b">
        <div class="xs:flex flex-col hidden">
          <h1 class="text-xl lg:text-2xl font-semibold ibm-plex-serif">
            {{ welcomeMessage }}, {{ getSignedInUser().name.split(" ").at(0) }}
          </h1>
          <p class="text-sm text-muted-foreground">Welcome to PractoCore, Your Litigation Deadline Management Expert</p>
        </div>

        <div data-tour-guide="statistics" class="flex flex-col xs:grid xs:grid-cols-2 lg:flex lg:flex-row gap-3">
          <div class="flex flex-col p-3 border bg-background">
            <span class="text-lg font-medium">{{ statistics?.completedDeadlines ?? '—' }}</span>
            <span class="text-xs text-muted-foreground">Completed Deadlines</span>
          </div>

          <div class="flex flex-col p-3 border bg-background">
            <span class="text-lg font-medium">{{ statistics?.activeDeadlines ?? '—' }}</span>
            <span class="text-xs text-muted-foreground">Active Deadlines</span>
          </div>

          <div
            class="flex flex-col p-3 border bg-background"
            :class="{ 'border-destructive': statistics?.missedDeadlines > 0 }"
          >
            <span
              class="text-lg font-medium"
              :class="{ 'text-destructive': statistics?.missedDeadlines > 0 }"
            >{{ statistics?.missedDeadlines ?? '—' }}</span>
            <span class="text-xs text-muted-foreground">Missed Deadlines</span>
          </div>
        </div>
      </div>

      <!-- Main content grid -->
      <div class="grid grid-cols-1 lg:grid-cols-4 h-full">
        <!-- Upcoming deadlines column -->
        <div class="flex flex-col lg:col-span-3 border-r p-3 gap-3">
          <div class="flex flex-row justify-between">
            <div class="flex flex-row gap-1 items-center">
              <h2 class="font-semibold ibm-plex-sans">Upcoming Deadlines</h2>

              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button size="icon" class="size-11" variant="ghost" aria-label="Help and tour options">
                    <Info aria-hidden="true"/>
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
                <Plus aria-hidden="true"/>
                Create Matter
              </Button>
            </SharedMattersCreateMatter>
            <div class="flex flex-row items-center gap-2" v-else>
              <NuxtLink to="/main/matters">
                <Button size="sm" variant="secondary">View All</Button>
              </NuxtLink>

              <SharedMattersCreateMatter @created="reloadStatistics">
                <Button data-tour-guide="create-matter" size="icon-sm" aria-label="Create new matter">
                  <Plus aria-hidden="true"/>
                </Button>
              </SharedMattersCreateMatter>
            </div>
          </div>

          <XyzTransition data-tour-guide="upcoming" xyz="fade" mode="out-in">
            <div v-if="loading"
                 class="flex flex-col h-32 w-full bg-muted border rounded-xl place-items-center justify-center">
              <Loader class="size-5 animate-spin" aria-hidden="true"/>
              <span class="sr-only">Loading deadlines</span>
            </div>

            <div v-else-if="statistics?.matters?.length > 0"
                 class="flex flex-col border bg-muted divide-y overflow-hidden rounded-xl">
              <NuxtLink
                v-for="matter in statistics?.matters"
                :key="matter?.id"
                :to="`/main/matters/matter/${matter?.id}`"
                :aria-label="`View matter: ${matter?.name}`"
              >
                <div class="flex flex-col lg:flex-row lg:items-center h-full justify-between hover:bg-accent hover:text-primary transition-colors ease-out duration-150">
                  <div class="flex flex-col p-3 w-full">
                    <div class="flex flex-row gap-1 items-center">
                      <span class="font-semibold text-sm text-muted-foreground">Matter</span>
                      <div class="size-1 rounded-full bg-muted-foreground" aria-hidden="true"></div>
                      <span class="font-semibold text-sm text-muted-foreground">{{ matter?.caseNumber }}</span>
                    </div>
                    <span class="font-medium text-lg">{{ matter?.name }}</span>
                  </div>

                  <div class="flex flex-col lg:flex-row h-full w-full lg:items-center">
                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                      <span class="font-semibold text-sm text-muted-foreground">Events</span>
                      <div class="flex flex-row gap-1 items-center">
                        <CalendarIcon class="size-4" aria-hidden="true"/>
                        <span class="font-medium text-sm">{{ matter?.stats?.upcoming }} events</span>
                      </div>
                    </div>

                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                      <span class="font-semibold text-sm text-muted-foreground">Completion</span>
                      <div v-if="matter?.stats?.completion > 0" class="flex flex-row gap-1 items-center">
                        <CircleProgressBar :value="matter?.stats?.completion" :max="100" rounded
                                           class="size-4" strokeWidth="10" aria-hidden="true"/>
                        <span class="font-medium text-sm">{{ matter?.stats?.completion }}%</span>
                      </div>
                      <span v-else aria-label="No completion data">—</span>
                    </div>

                    <div class="flex flex-col p-3 px-5 h-full justify-center">
                      <span class="font-semibold text-sm text-muted-foreground">Next Deadline</span>
                      <div
                        class="flex flex-row gap-1 items-center"
                        :class="{ 'text-destructive font-semibold': isUrgent(matter) }"
                      >
                        <AlertTriangle v-if="isUrgent(matter)" class="size-4" aria-hidden="true"/>
                        <Clock v-else class="size-4" aria-hidden="true"/>
                        <span v-if="matter" class="font-medium text-sm">
                          {{ dayjs(matter?.stats?.nextDeadlineDate).fromNow() }}
                          <span v-if="isUrgent(matter)" class="sr-only">(urgent)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>

            <div v-else class="flex flex-col w-full bg-muted border p-8 rounded-xl items-center gap-4 text-center">
              <XCircle class="size-12 text-muted-foreground" aria-hidden="true"/>
              <div class="flex flex-col gap-1">
                <p class="font-semibold text-foreground">No matters yet</p>
                <p class="text-sm text-muted-foreground">Create your first matter to start tracking litigation deadlines automatically.</p>
              </div>
              <SharedMattersCreateMatter class="w-fit" @created="reloadStatistics">
                <Button>
                  <Plus class="size-4" aria-hidden="true"/>
                  Create Your First Matter
                </Button>
              </SharedMattersCreateMatter>
            </div>
          </XyzTransition>
        </div>

        <!-- Calendar column -->
        <div class="flex flex-col lg:col-span-1 p-3 gap-3">
          <div class="flex flex-row justify-between items-center">
            <h2 class="font-semibold">Your Calendar</h2>

            <NuxtLink to="/main/calendar">
              <Button size="sm" variant="secondary">Details</Button>
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