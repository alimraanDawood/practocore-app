<script lang="ts" setup>
import { Briefcase, ArrowLeft, Loader2, Check, Circle, CircleDot } from 'lucide-vue-next';
import {
  getEngagement, listMilestones, updateMilestoneStatus, updateEngagement,
  type Engagement, type EngagementMilestone, type EngagementTemplate,
} from '~/services/engagements';

definePageMeta({ layout: 'default' });

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.id as string);

const engagement = ref<Engagement | null>(null);
const milestones = ref<EngagementMilestone[]>([]);
const loading = ref(true);
const loadError = ref('');
const busyMilestone = ref('');
const savingStatus = ref(false);

const template = computed<EngagementTemplate | undefined>(() => engagement.value?.expand?.template);

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    engagement.value = await getEngagement(id.value);
    milestones.value = await listMilestones(id.value);
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load engagement.';
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);
watch(id, refresh);

const stages = computed(() => template.value?.data?.stages?.slice().sort((a, b) => a.order - b.order) ?? []);
const currentStageId = computed(() => engagement.value?.stageStatus?.currentStageId ?? '');
const completedStageIds = computed(() => new Set(engagement.value?.stageStatus?.completedStageIds ?? []));

function stageState(stageId: string): 'done' | 'current' | 'pending' {
  if (completedStageIds.value.has(stageId)) return 'done';
  if (stageId === currentStageId.value) return 'current';
  return 'pending';
}

const milestonesByStage = computed(() => {
  const map = new Map<string, EngagementMilestone[]>();
  for (const m of milestones.value) {
    const key = m.stageId || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return map;
});

async function toggleMilestone(m: EngagementMilestone) {
  busyMilestone.value = m.id;
  const next = m.status === 'done' ? 'pending' : 'done';
  try {
    const updated = await updateMilestoneStatus(m.id, next);
    const idx = milestones.value.findIndex((x) => x.id === m.id);
    if (idx >= 0) milestones.value[idx] = updated;
  } finally {
    busyMilestone.value = '';
  }
}

async function setStatus(status: Engagement['status']) {
  if (!engagement.value) return;
  savingStatus.value = true;
  try {
    engagement.value = await updateEngagement(engagement.value.id, { status });
  } finally {
    savingStatus.value = false;
  }
}

const statusOptions: Engagement['status'][] = ['draft', 'active', 'completed', 'archived'];
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto">
    <div v-if="loading" class="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="size-5 animate-spin mr-2" /> Loading…
    </div>
    <div v-else-if="loadError" class="text-sm text-destructive p-6">{{ loadError }}</div>
    <template v-else-if="engagement">
      <div class="flex flex-col gap-4 p-4 sm:p-6 border-b">
        <Button variant="ghost" size="sm" class="w-fit -ml-2" @click="router.push('/main/engagements')">
          <ArrowLeft class="size-4 mr-1.5" /> Engagements
        </Button>
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold flex items-center gap-2">
              <Briefcase class="size-5" />
              {{ engagement.name }}
            </h1>
            <p v-if="template" class="text-sm text-muted-foreground">{{ template.name }}</p>
          </div>
          <Select :model-value="engagement.status" :disabled="savingStatus" @update:model-value="(v) => setStatus(v as Engagement['status'])">
            <SelectTrigger class="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="s in statusOptions" :key="s" :value="s">{{ s }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p v-if="engagement.targetDate" class="text-sm text-muted-foreground">
          Target date: {{ new Date(engagement.targetDate).toLocaleDateString() }}
        </p>
      </div>

      <div class="flex flex-col gap-6 p-4 sm:p-6">
        <div v-if="stages.length > 0">
          <h2 class="text-sm font-medium text-muted-foreground mb-3">Stages</h2>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="s in stages"
              :key="s.id"
              class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              :class="{
                'border-primary bg-primary/10 text-primary': stageState(s.id) === 'current',
                'border-muted-foreground/20 text-muted-foreground': stageState(s.id) === 'done',
              }"
            >
              <Check v-if="stageState(s.id) === 'done'" class="size-3.5" />
              <CircleDot v-else-if="stageState(s.id) === 'current'" class="size-3.5" />
              <Circle v-else class="size-3.5" />
              {{ s.label }}
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-sm font-medium text-muted-foreground mb-3">Milestones</h2>
          <div v-if="milestones.length === 0" class="text-sm text-muted-foreground">No milestones.</div>
          <div v-else class="flex flex-col gap-2">
            <Card v-for="m in milestones" :key="m.id" class="p-3 flex flex-row items-center gap-3">
              <Checkbox
                :model-value="m.status === 'done'"
                :disabled="busyMilestone === m.id"
                @update:model-value="toggleMilestone(m)"
              />
              <div class="flex-1">
                <p class="text-sm" :class="{ 'line-through text-muted-foreground': m.status === 'done' }">{{ m.label }}</p>
                <p v-if="m.dueDate" class="text-xs text-muted-foreground">
                  Due {{ new Date(m.dueDate).toLocaleDateString() }}
                </p>
              </div>
              <Badge v-if="m.status === 'skipped'" variant="outline">Skipped</Badge>
            </Card>
          </div>
        </div>

        <div v-if="Object.keys(engagement.fieldValues || {}).length > 0">
          <h2 class="text-sm font-medium text-muted-foreground mb-3">Details</h2>
          <Card class="p-4">
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div v-for="(value, key) in engagement.fieldValues" :key="key">
                <dt class="text-muted-foreground">{{ key }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>
