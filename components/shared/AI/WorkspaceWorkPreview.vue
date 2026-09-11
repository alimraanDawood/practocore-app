<script lang="ts" setup>
import {
  ArrowUpRight, Briefcase, CalendarClock, CheckCircle2, Circle,
  FileText, FolderLock, Info, Loader2, Scale, TriangleAlert,
} from 'lucide-vue-next';
import { getEngagement, listMilestones, type Engagement, type EngagementMilestone } from '~/services/engagements';
import { matterStatusOf, MATTER_STATUS_LABELS } from '~/services/matters';
import { cn } from '~/lib/utils';

const props = defineProps<{
  kind: 'matter' | 'engagement';
  id: string;
}>();

const mattersStore = useMattersStore();
const loading = ref(true);
const error = ref('');
const matter = ref<any | null>(null);
const engagement = ref<Engagement | null>(null);
const milestones = ref<EngagementMilestone[]>([]);
let request = 0;

const title = computed(() => props.kind === 'matter'
  ? matter.value?.name || 'Matter'
  : engagement.value?.name || 'Engagement');

const reference = computed(() => props.kind === 'matter'
  ? matter.value?.caseNumber || 'Litigation matter'
  : engagement.value?.expand?.template?.name || 'Engagement');

const status = computed(() => props.kind === 'matter'
  ? MATTER_STATUS_LABELS[matterStatusOf(matter.value)]
  : engagement.value?.status || 'active');

const stages = computed(() => engagement.value?.expand?.template?.data?.stages
  ?.slice()
  .sort((a, b) => a.order - b.order) ?? []);

const currentStage = computed(() => {
  const id = engagement.value?.stageStatus?.currentStageId;
  return stages.value.find(stage => stage.id === id)?.label || 'Not started';
});

const completedMilestones = computed(() => milestones.value.filter(item => item.status === 'done').length);
const activeSection = ref(props.kind === 'matter' ? 'timeline' : 'progress');

function formatDate(value?: string): string {
  if (!value) return 'No date set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}

function isOverdue(value?: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
}

async function load() {
  const current = ++request;
  loading.value = true;
  error.value = '';
  matter.value = null;
  engagement.value = null;
  milestones.value = [];

  try {
    if (props.kind === 'matter') {
      const record = await mattersStore.fetchMatter(props.id, { showLoading: false });
      if (current === request) matter.value = record;
    } else {
      const [record, items] = await Promise.all([
        getEngagement(props.id),
        listMilestones(props.id),
      ]);
      if (current === request) {
        engagement.value = record;
        milestones.value = items;
      }
    }
  } catch (cause: any) {
    if (current === request) error.value = cause?.message || `Could not load this ${props.kind}.`;
  } finally {
    if (current === request) loading.value = false;
  }
}

function openFullRecord() {
  return navigateTo(props.kind === 'matter'
    ? `/main/matters/matter/${props.id}`
    : `/main/engagements/${props.id}`);
}

watch(() => [props.kind, props.id], () => {
  activeSection.value = props.kind === 'matter' ? 'timeline' : 'progress';
  load();
}, { immediate: true });
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <header class="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
      <div class="flex min-w-0 items-start gap-3">
        <div class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <Scale v-if="kind === 'matter'" class="size-4 text-muted-foreground" />
          <Briefcase v-else class="size-4 text-muted-foreground" />
        </div>
        <div class="min-w-0">
          <div class="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{{ kind === 'matter' ? 'Matter' : 'Engagement' }}</Badge>
            <Badge v-if="!loading" variant="outline" class="capitalize">{{ status }}</Badge>
          </div>
          <h2 class="truncate text-lg font-semibold">{{ title }}</h2>
          <p class="truncate text-sm text-muted-foreground">{{ reference }}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" class="shrink-0" @click="openFullRecord">
        <ArrowUpRight data-icon="inline-end" />
        Open full file
      </Button>
    </header>

    <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center">
      <Loader2 class="size-5 animate-spin text-muted-foreground" />
      <span class="sr-only">Loading {{ kind }}</span>
    </div>

    <div v-else-if="error" class="flex min-h-0 flex-1 items-center justify-center p-6">
      <Alert variant="destructive" class="max-w-md">
        <TriangleAlert />
        <AlertTitle>Could not open {{ kind }}</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>

    <Tabs v-else v-model="activeSection" class="flex min-h-0 flex-1 flex-col">
      <div class="shrink-0 overflow-x-auto border-b px-4">
        <TabsList class="h-10 w-max justify-start rounded-none bg-transparent p-0">
          <template v-if="kind === 'matter'">
            <TabsTrigger value="timeline"><CalendarClock />Timeline</TabsTrigger>
            <TabsTrigger value="milestones"><CheckCircle2 />Milestones</TabsTrigger>
            <TabsTrigger value="details"><Info />Details</TabsTrigger>
            <TabsTrigger value="documents"><FolderLock />Case files</TabsTrigger>
            <TabsTrigger value="drafts"><FileText />AI drafts</TabsTrigger>
          </template>
          <template v-else>
            <TabsTrigger value="progress"><CheckCircle2 />Progress</TabsTrigger>
            <TabsTrigger value="details"><Info />Details</TabsTrigger>
            <TabsTrigger value="documents"><FolderLock />Vault</TabsTrigger>
            <TabsTrigger value="drafts"><FileText />Drafts</TabsTrigger>
          </template>
        </TabsList>
      </div>

      <template v-if="kind === 'matter' && matter">
        <TabsContent value="timeline" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedMattersMatterTimeline :matter="matter" application-filter="all" @updated="load" />
        </TabsContent>
        <TabsContent value="milestones" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedMattersMatterMilestones :matter-id="id" :can-edit="false" />
        </TabsContent>
        <TabsContent value="details" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedMattersMatterFields :matter="matter" :can-edit="false" @updated="load" />
        </TabsContent>
        <TabsContent value="documents" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedVaultEmbedded scope="matter" :scope-id="id" root-label="Case documents" />
        </TabsContent>
        <TabsContent value="drafts" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedDocumentsBrowser :matter-id="id" />
        </TabsContent>
      </template>

      <template v-else-if="engagement">
        <TabsContent value="progress" class="mt-0 min-h-0 flex-1 overflow-y-auto">
          <div class="grid grid-cols-3 border-b">
            <div class="px-5 py-4">
              <p class="text-xs text-muted-foreground">Current stage</p>
              <p class="mt-1 truncate text-sm font-medium">{{ currentStage }}</p>
            </div>
            <div class="border-x px-5 py-4">
              <p class="text-xs text-muted-foreground">Target date</p>
              <p class="mt-1 text-sm font-medium">{{ formatDate(engagement.targetDate) }}</p>
            </div>
            <div class="px-5 py-4">
              <p class="text-xs text-muted-foreground">Milestones</p>
              <p class="mt-1 text-sm font-medium">{{ completedMilestones }} of {{ milestones.length }} complete</p>
            </div>
          </div>
          <section class="px-5 py-5">
            <div v-if="milestones.length" class="divide-y rounded-md border">
              <div v-for="milestone in milestones" :key="milestone.id" class="flex items-center gap-3 px-3 py-3">
                <CheckCircle2 v-if="milestone.status === 'done'" class="size-4 shrink-0 text-primary" />
                <Circle v-else class="size-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0 flex-1">
                  <p :class="cn('truncate text-sm font-medium', milestone.status === 'done' && 'text-muted-foreground line-through')">
                    {{ milestone.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">{{ formatDate(milestone.dueDate) }}</p>
                </div>
                <Badge v-if="milestone.status === 'pending' && milestone.dueDate && isOverdue(milestone.dueDate)" variant="destructive">Overdue</Badge>
                <Badge v-else variant="outline" class="capitalize">{{ milestone.status }}</Badge>
              </div>
            </div>
            <Empty v-else class="min-h-52 border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Briefcase /></EmptyMedia>
                <EmptyTitle>No milestones yet</EmptyTitle>
                <EmptyDescription>This engagement does not have any milestones to show.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </section>
        </TabsContent>
        <TabsContent value="details" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedEngagementsEngagementFields
            :engagement="engagement"
            :template="engagement.expand?.template"
            :can-edit="false" />
        </TabsContent>
        <TabsContent value="documents" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedVaultEmbedded scope="engagement" :scope-id="id" root-label="Engagement documents" />
        </TabsContent>
        <TabsContent value="drafts" class="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <SharedDocumentsBrowser :engagement-id="id" />
        </TabsContent>
      </template>
    </Tabs>
  </div>
</template>
