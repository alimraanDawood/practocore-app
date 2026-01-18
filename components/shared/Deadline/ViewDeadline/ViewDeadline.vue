<template>
    <div v-if="noSheet" class="flex flex-col w-full h-full overflow-hidden">
        <!-- Header with deadline info -->
        <div class="flex flex-col border-b bg-background p-4">
            <div class="flex flex-row items-start justify-between mb-3">
                <div class="flex flex-col flex-1">
                    <div class="flex flex-row items-center gap-2 mb-1">
                        <h3 class="font-semibold text-lg">{{ deadline.name }}</h3>
                        <Badge v-if="getDeadlineStatus() === 'pending'">
                            <Clock class="size-3 mr-1" /> Pending
                        </Badge>
                        <Badge v-else-if="getDeadlineStatus() === 'overdue'"
                            variant="destructive">
                            <AlertTriangle class="size-3 mr-1" /> Overdue
                        </Badge>
                        <Badge v-else-if="getDeadlineStatus() === 'completed'">
                            <CheckCircle class="size-3 mr-1" /> Completed
                        </Badge>
                    </div>

                    <div class="flex flex-row items-center gap-2 text-sm text-muted-foreground">
                        <CalendarIcon class="size-4" />
                        <span class="font-medium">{{ dayjs(deadline.date).format("dddd, MMMM D, YYYY") }}</span>
                        <span>•</span>
                        <span>{{ dayjs(deadline.date).fromNow() }}</span>
                    </div>

                    <div v-if="deadline.expand?.matter" class="flex flex-row items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Briefcase class="size-3" />
                        <span>{{ deadline.expand.matter.name }}</span>
                    </div>
                </div>
            </div>

            <div v-if="deadline.description" class="flex flex-col gap-1">
                <span class="text-xs font-semibold text-muted-foreground">Description</span>
                <p class="text-sm">{{ deadline.description }}</p>
            </div>
        </div>

        <!-- Matter Timeline -->
        <div v-if="matter" class="flex flex-col flex-1 overflow-y-scroll p-4">
            <div class="flex flex-row items-center justify-between mb-3">
                <h4 class="font-semibold text-sm">Matter Timeline</h4>
                <Badge variant="secondary" class="text-xs">{{ matter.expand?.deadlines?.length || 0 }} deadlines</Badge>
            </div>

            <!-- Timeline -->
            <div class="flex flex-col gap-2">
                <!-- Sorted deadlines -->
                <div v-for="(dl, idx) in sortedDeadlines" :key="dl.id"
                     class="flex flex-row w-full group relative"
                     :class="{
                       'ring-2 ring-primary rounded-lg': dl.id === deadline.id,
                       'opacity-60': dl.id !== deadline.id
                     }">
                  <div class="flex flex-col px-2 items-center">
                    <div class="w-1 h-5 bg-muted group-first:opacity-0"
                         :class="{ 'bg-primary': dl.completed }"></div>
                    <div class="size-8 shrink-0 rounded-full grid place-items-center border-2 transition-all"
                         :class="dl.id === deadline.id
                           ? 'bg-primary text-primary-foreground border-primary scale-110'
                           : dl.completed
                             ? 'bg-primary text-primary-foreground border-primary'
                             : 'bg-muted border-muted'">
                      <CheckCircle v-if="dl.completed" class="size-4"/>
                      <Clock v-else class="size-4"/>
                    </div>
                    <div class="w-1 h-full bg-muted group-last:opacity-0"
                         :class="{ 'bg-primary': dl.completed }"></div>
                  </div>

                  <div class="flex flex-col w-full justify-center gap-1 py-3 pr-2">
                    <div class="flex flex-row items-center gap-2">
                      <span class="text-sm font-semibold"
                            :class="{ 'text-primary': dl.id === deadline.id }">
                        {{ dl.name }}
                      </span>
                      <Target v-if="dl.id === deadline.id" class="size-3 text-primary" />
                    </div>

                    <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
                      <span>{{ dayjs(dl.date).format("D MMM YYYY") }}</span>
                      <span>•</span>
                      <span>{{ dayjs(dl.date).fromNow() }}</span>
                    </div>

                    <div v-if="dl.description && dl.id === deadline.id"
                         class="text-xs text-muted-foreground mt-1">
                      {{ dl.description }}
                    </div>
                  </div>
                </div>
            </div>
        </div>

        <!-- Loading state for matter -->
        <div v-else class="flex flex-col flex-1 overflow-y-scroll p-4">
            <div class="flex flex-col gap-2 animate-pulse">
                <div class="h-4 bg-muted rounded w-1/3 mb-3"></div>
                <div v-for="i in 3" :key="i" class="flex flex-row gap-2">
                    <div class="size-8 bg-muted rounded-full shrink-0"></div>
                    <div class="flex flex-col gap-2 flex-1">
                        <div class="h-4 bg-muted rounded w-2/3"></div>
                        <div class="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2 p-4 border-t bg-background">
            <SharedDeadlineCompleteDeadline v-if="deadline.dynamic" :deadline="deadline" :index="index"
                @updated="handleUpdate">
                <Button v-if="!deadline.completed" class="w-full">
                    <CheckCircle class="size-4 mr-2" />
                    {{ deadline?.action || 'Mark as Complete' }}
                </Button>
                <Button v-else variant="secondary" class="w-full" disabled>
                    <CheckCircle class="size-4 mr-2" />
                    Completed
                </Button>
            </SharedDeadlineCompleteDeadline>

            <div class="flex flex-row gap-2">
                <Button class="flex-1" variant="outline" @click="navigateToMatter" v-if="deadline.expand?.matter">
                    <ExternalLink class="size-4 mr-2" />
                    View Matter
                </Button>
            </div>
        </div>
    </div>
    <Sheet v-else :modal="true" v-model:open="open">
        <SheetTrigger :as-child="true">
            <slot />
        </SheetTrigger>

        <SheetContent :hide-block="true" class="w-screen xs:pt-5 xs:pb-12 flex flex-col overflow-hidden">
            <SheetHeader class="px-4">
                <SheetTitle>Deadline Details</SheetTitle>
            </SheetHeader>

            <div class="flex flex-col flex-1 overflow-y-scroll">
                <!-- Header with deadline info -->
                <div class="flex flex-col border-b bg-background p-4">
                    <div class="flex flex-row items-start justify-between mb-3">
                        <div class="flex flex-col flex-1">
                            <div class="flex flex-row items-center gap-2 mb-1 flex-wrap">
                                <h3 class="font-semibold text-lg">{{ deadline.name }}</h3>
                                <Badge v-if="getDeadlineStatus() === 'pending'">
                                    <Clock class="size-3 mr-1" /> Pending
                                </Badge>
                                <Badge v-else-if="getDeadlineStatus() === 'overdue'"
                                    variant="destructive">
                                    <AlertTriangle class="size-3 mr-1" /> Overdue
                                </Badge>
                                <Badge v-else-if="getDeadlineStatus() === 'completed'">
                                    <CheckCircle class="size-3 mr-1" /> Completed
                                </Badge>
                            </div>

                            <div class="flex flex-row items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                <CalendarIcon class="size-4" />
                                <span class="font-medium">{{ dayjs(deadline.date).format("D MMM YYYY") }}</span>
                                <span>•</span>
                                <span>{{ dayjs(deadline.date).fromNow() }}</span>
                            </div>

                            <div v-if="deadline.expand?.matter" class="flex flex-row items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Briefcase class="size-3" />
                                <span>{{ deadline.expand.matter.name }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="deadline.description" class="flex flex-col gap-1">
                        <span class="text-xs font-semibold text-muted-foreground">Description</span>
                        <p class="text-sm">{{ deadline.description }}</p>
                    </div>
                </div>

                <!-- Matter Timeline -->
                <div v-if="matter" class="flex flex-col p-4">
                    <div class="flex flex-row items-center justify-between mb-3">
                        <h4 class="font-semibold text-sm">Matter Timeline</h4>
                        <Badge variant="secondary" class="text-xs">{{ matter.expand?.deadlines?.length || 0 }} deadlines</Badge>
                    </div>

                    <!-- Timeline -->
                    <div class="flex flex-col gap-2">
                        <div v-for="(dl, idx) in sortedDeadlines" :key="dl.id"
                             class="flex flex-row w-full group relative"
                             :class="{
                               'ring-2 ring-primary rounded-lg': dl.id === deadline.id,
                               'opacity-60': dl.id !== deadline.id
                             }">
                          <div class="flex flex-col px-2 items-center">
                            <div class="w-1 h-5 bg-muted group-first:opacity-0"
                                 :class="{ 'bg-primary': dl.completed }"></div>
                            <div class="size-8 shrink-0 rounded-full grid place-items-center border-2 transition-all"
                                 :class="dl.id === deadline.id
                                   ? 'bg-primary text-primary-foreground border-primary scale-110'
                                   : dl.completed
                                     ? 'bg-primary text-primary-foreground border-primary'
                                     : 'bg-muted border-muted'">
                              <CheckCircle v-if="dl.completed" class="size-4"/>
                              <Clock v-else class="size-4"/>
                            </div>
                            <div class="w-1 h-full bg-muted group-last:opacity-0"
                                 :class="{ 'bg-primary': dl.completed }"></div>
                          </div>

                          <div class="flex flex-col w-full justify-center gap-1 py-3 pr-2">
                            <div class="flex flex-row items-center gap-2">
                              <span class="text-sm font-semibold"
                                    :class="{ 'text-primary': dl.id === deadline.id }">
                                {{ dl.name }}
                              </span>
                              <Target v-if="dl.id === deadline.id" class="size-3 text-primary" />
                            </div>

                            <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
                              <span>{{ dayjs(dl.date).format("D MMM YYYY") }}</span>
                              <span>•</span>
                              <span>{{ dayjs(dl.date).fromNow() }}</span>
                            </div>
                          </div>
                        </div>
                    </div>
                </div>

                <!-- Loading state -->
                <div v-else class="flex flex-col p-4">
                    <div class="flex flex-col gap-2 animate-pulse">
                        <div class="h-4 bg-muted rounded w-1/3 mb-3"></div>
                        <div v-for="i in 3" :key="i" class="flex flex-row gap-2">
                            <div class="size-8 bg-muted rounded-full shrink-0"></div>
                            <div class="flex flex-col gap-2 flex-1">
                                <div class="h-4 bg-muted rounded w-2/3"></div>
                                <div class="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SheetFooter class="p-4 border-t">
                <div class="flex flex-col gap-1 w-full">
                    <SharedDeadlineCompleteDeadline v-if="deadline.dynamic" :deadline="deadline" :index="index"
                        @updated="handleUpdate">
                        <Button v-if="!deadline.completed" class="w-full">
                            <CheckCircle class="size-4 mr-2" />
                            {{ deadline?.action || 'Mark as Complete' }}
                        </Button>
                        <Button v-else variant="secondary" class="w-full" disabled>
                            <CheckCircle class="size-4 mr-2" />
                            Completed
                        </Button>
                    </SharedDeadlineCompleteDeadline>

                    <div class="flex flex-row gap-2">
                        <Button class="flex-1" variant="outline" @click="navigateToMatter" v-if="deadline.expand?.matter">
                            <ExternalLink class="size-4 mr-2" />
                            View Matter
                        </Button>
                    </div>

                    <SheetClose class="w-full">
                        <Button class="w-full" variant="secondary">Close</Button>
                    </SheetClose>
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
    CalendarIcon,
    CheckCircle,
    Clock,
    AlertTriangle,
    Briefcase,
    Target,
    Edit,
    ExternalLink
} from 'lucide-vue-next';
import { getMatter } from '~/services/matters';

dayjs.extend(relativeTime);

const props = defineProps(['deadline', 'index', 'noSheet']);
const emits = defineEmits(['updated']);
const router = useRouter();

const open = ref(false);
const matter = ref(null);
const loadingMatter = ref(false);

// Fetch matter data when deadline has a matter
watch(() => props.deadline, async (newDeadline) => {
    if (newDeadline?.matter) {
        loadingMatter.value = true;
        try {
            matter.value = await getMatter(newDeadline.matter, {
                expand: 'deadlines'
            });
        } catch (error) {
            console.error('Failed to fetch matter:', error);
        } finally {
            loadingMatter.value = false;
        }
    }
}, { immediate: true });

// Also watch the open state for sheet mode
watch(open, async (isOpen) => {
    if (isOpen && props.deadline?.matter && !matter.value) {
        loadingMatter.value = true;
        try {
            matter.value = await getMatter(props.deadline.matter, {
                expand: 'deadlines'
            });
        } catch (error) {
            console.error('Failed to fetch matter:', error);
        } finally {
            loadingMatter.value = false;
        }
    }
});

// Sort deadlines by date
const sortedDeadlines = computed(() => {
    if (!matter.value?.expand?.deadlines) return [];
    return [...matter.value.expand.deadlines].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
});

// Get deadline status
const getDeadlineStatus = () => {
    if (props.deadline.completed) return 'completed';
    const now = new Date();
    const deadlineDate = new Date(props.deadline.date);
    if (now > deadlineDate) return 'overdue';
    return 'pending';
};

// Navigate to matter page
const navigateToMatter = () => {
    if (props.deadline.expand?.matter) {
        router.push(`/main/matters/matter/${props.deadline.matter}`);
    }
};

const handleUpdate = () => {
    open.value = false;
    emits('updated');
};
</script>