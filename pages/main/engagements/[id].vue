<script lang="ts" setup>
import { Briefcase, ArrowLeft, ChevronLeft, Loader, Check, Circle, CircleDot, CalendarClock, ListChecks, FolderLock, FileType2, Users, RefreshCw, Pause, Play, X, Bell, BellOff, FileCheck2, PlayCircle, Plus, CalendarPlus, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  getEngagement, listMilestones, updateMilestoneStatus, updateEngagement,
  listEngagementCompliance, updateComplianceStatus, setMilestoneReminder,
  spawnCompliance, listPendingFilings, deleteMilestone,
  subscribeEngagement, unsubscribeEngagement, subscribeMilestones, unsubscribeMilestones,
  subscribeCompliance, unsubscribeCompliance,
  type Engagement, type EngagementMilestone, type EngagementTemplate, type ComplianceObligation, type ComplianceStatus, type ComplianceFiling, type TemplateStage,
} from '~/services/engagements';

definePageMeta({ layout: 'default' });

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.id as string);

const engagement = ref<Engagement | null>(null);
const milestones = ref<EngagementMilestone[]>([]);
const compliance = ref<ComplianceObligation[]>([]);
const loading = ref(true);
const loadError = ref('');
const busyMilestone = ref('');
const busyReminder = ref('');
const busyObligation = ref('');
const savingStatus = ref(false);
const spawning = ref(false);

// Current open occurrence per obligation (for "Record filing") + the mark-filed dialog.
const pendingByObligation = ref<Record<string, ComplianceFiling>>({});
const fileDialogOpen = ref(false);
const activeFiling = ref<ComplianceFiling | null>(null);

const template = computed<EngagementTemplate | undefined>(() => engagement.value?.expand?.template);

// Tab selection is URL-backed (`?tab=`) so links can deep-link into an
// engagement's Vault or Drafted documents (mirrors the matter page pattern).
const ENGAGEMENT_TABS = ['progress', 'documents', 'drafts'];
const activeTab = computed({
  get() {
    const t = route.query.tab;
    return typeof t === 'string' && ENGAGEMENT_TABS.includes(t) ? t : 'progress';
  },
  set(t: string) {
    router.replace({ query: { ...route.query, tab: t } });
  },
});

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    engagement.value = await getEngagement(id.value);
    milestones.value = await listMilestones(id.value);
    compliance.value = await listEngagementCompliance(id.value);
    await refreshPendingFilings();
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load engagement.';
  } finally {
    loading.value = false;
  }
}
// ── Live reload ─────────────────────────────────────────────────────────────
// Keep the page in sync as the assistant (or a colleague) mutates this engagement
// in real time — add/remove/complete a milestone, move a due date, toggle a
// reminder, change the target date — with no manual refresh. Backed by PocketBase
// realtime; the collections' own access rules scope which events each user sees.

// Patch the milestone list from a realtime event scoped to this engagement.
function applyMilestoneEvent(action: string, record: EngagementMilestone) {
  if (!engagement.value || record.engagement !== engagement.value.id) return;
  const idx = milestones.value.findIndex((m) => m.id === record.id);
  if (action === 'delete') {
    if (idx >= 0) milestones.value.splice(idx, 1);
    return;
  }
  if (idx >= 0) milestones.value[idx] = record;
  else milestones.value.push(record);
  // Keep due order (undated last) so a newly dated/moved milestone lands in place.
  milestones.value.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
}

async function startRealtime(engagementId: string) {
  // Engagement row: the raw event lacks template/members/owner expands, so re-fetch.
  await subscribeEngagement(engagementId, async (e: any) => {
    if (e.record?.id !== engagementId) return;
    try { engagement.value = await getEngagement(engagementId); } catch { /* transient */ }
  });
  // Milestones subscribe to '*'; filter to this engagement in the handler.
  await subscribeMilestones((e: any) => {
    if (e.record) applyMilestoneEvent(e.action, e.record as EngagementMilestone);
  });
  // Compliance tail: re-pull the engagement's obligations + open filings on any change.
  await subscribeCompliance(async (e: any) => {
    if (e.record?.engagement !== engagementId) return;
    try {
      compliance.value = await listEngagementCompliance(engagementId);
      await refreshPendingFilings();
    } catch { /* transient */ }
  });
}

function stopRealtime(engagementId: string) {
  unsubscribeEngagement(engagementId);
  unsubscribeMilestones();
  unsubscribeCompliance();
}

onMounted(async () => {
  await refresh();
  await startRealtime(id.value);
});
onUnmounted(() => stopRealtime(id.value));
watch(id, async (newId, oldId) => {
  if (oldId) stopRealtime(oldId);
  await refresh();
  await startRealtime(newId);
});

const stages = computed(() => template.value?.data?.stages?.slice().sort((a, b) => a.order - b.order) ?? []);
const currentStageId = computed(() => engagement.value?.stageStatus?.currentStageId ?? '');
const completedStageIds = computed(() => new Set(engagement.value?.stageStatus?.completedStageIds ?? []));

function stageState(stageId: string): 'done' | 'current' | 'pending' {
  if (completedStageIds.value.has(stageId)) return 'done';
  if (stageId === currentStageId.value) return 'current';
  return 'pending';
}

// Floating assistant dock: anchor the chat to this engagement while the page is open.
// Engagements have no structured-context axis, so the identity + current stage ride as
// a text header only.
const currentStageName = computed(() => stages.value.find((s: any) => s.id === currentStageId.value)?.name ?? '');
provideDockContext(() => {
  const eng = engagement.value;
  if (!eng?.id) return null;
  const bits = [`The user is viewing the engagement "${eng.name}"${template.value?.name ? ` (${template.value.name})` : ''} (engagementId: ${eng.id}) in PractoCore.`];
  if (currentStageName.value) bits.push(`Its current stage is "${currentStageName.value}".`);
  bits.push('Use get_engagement with this engagementId to inspect its milestones/stages before acting. Scope answers and actions to this engagement unless told otherwise.');
  return {
    key: `engagement:${eng.id}`,
    label: eng.name || 'Engagement',
    sublabel: template.value?.name || 'Engagement',
    icon: Briefcase,
    // Attach as a structured chip (→ engagementIds) so it shows in the composer AND the
    // backend pins it into context; the text header adds the live current-stage detail.
    chips: [{ type: 'engagement', id: eng.id, label: eng.name || 'Engagement', sublabel: template.value?.name }],
    contextText: bits.join(' '),
  };
});


async function toggleMilestone(m: EngagementMilestone) {
  busyMilestone.value = m.id;
  const next = m.status === 'done' ? 'pending' : 'done';
  try {
    const updated = await updateMilestoneStatus(m.id, next);
    const idx = milestones.value.findIndex((x) => x.id === m.id);
    if (idx >= 0) milestones.value[idx] = updated;
    // The server recomputes stage progress synchronously on this change; refresh
    // the engagement so the stage pills advance live.
    engagement.value = await getEngagement(id.value);
  } finally {
    busyMilestone.value = '';
  }
}

// Toggle a reminder on any dated milestone — the backend schedules/cancels the
// standalone reminder from this flag (fix d). Reminders need a due date to fire.
async function toggleReminder(m: EngagementMilestone) {
  busyReminder.value = m.id;
  try {
    const updated = await setMilestoneReminder(m.id, !m.remind);
    const idx = milestones.value.findIndex((x) => x.id === m.id);
    if (idx >= 0) milestones.value[idx] = updated;
    if (updated.remind && !m.dueDate) {
      toast.info('Reminder on — set a due date on this milestone for it to fire.');
    }
  } catch (e: any) {
    toast.error(e?.message || 'Could not update reminder');
  } finally {
    busyReminder.value = '';
  }
}

// ── Milestone scheduling (set due date + reminders, add ad-hoc milestones) ──
const scheduleOpen = ref(false);
const scheduleTarget = ref<EngagementMilestone | null>(null); // null = adding a new one

function openSchedule(m: EngagementMilestone | null) {
  scheduleTarget.value = m;
  scheduleOpen.value = true;
}

// ── Milestone deletion (hard remove, vs. the "skipped" status) ──────────────
const deleteTarget = ref<EngagementMilestone | null>(null);
const deletingMilestone = ref(false);
const deleteDialogOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v: boolean) => { if (!v) deleteTarget.value = null; },
});

function confirmDeleteMilestone(m: EngagementMilestone) {
  deleteTarget.value = m;
}

async function doDeleteMilestone() {
  const m = deleteTarget.value;
  if (!m) return;
  deletingMilestone.value = true;
  try {
    await deleteMilestone(m.id);
    // Remove locally for immediacy; the realtime delete event is idempotent.
    const idx = milestones.value.findIndex((x) => x.id === m.id);
    if (idx >= 0) milestones.value.splice(idx, 1);
    // Deleting can complete a stage — re-read so the stage pills advance live.
    try { engagement.value = await getEngagement(id.value); } catch { /* transient */ }
    deleteTarget.value = null;
    toast.success('Milestone removed.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not remove milestone');
  } finally {
    deletingMilestone.value = false;
  }
}

function onMilestoneSaved(saved: EngagementMilestone) {
  const idx = milestones.value.findIndex((x) => x.id === saved.id);
  if (idx >= 0) milestones.value[idx] = saved;
  else milestones.value.push(saved);
  // Re-sort by due date so a newly dated milestone lands in order (undated last).
  milestones.value.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
}

// Summarise a milestone's reminder plan for the row (e.g. "7, 1 days before + on the day").
function reminderSummary(m: EngagementMilestone): string {
  if (!m.remind) return '';
  const offs = (m.reminderOffsets ?? []).slice().sort((a, b) => b - a);
  if (offs.length === 0) return 'Reminder on the day';
  const leads = offs.filter((n) => n > 0);
  const onDay = offs.includes(0);
  const parts: string[] = [];
  if (leads.length) parts.push(`${leads.join(', ')} day${leads.length === 1 && leads[0] === 1 ? '' : 's'} before`);
  if (onDay) parts.push('on the day');
  return `Reminders: ${parts.join(' + ')}`;
}

// The template declares recurring compliance for this engagement.
const hasComplianceRules = computed(() => (template.value?.data?.compliance?.length ?? 0) > 0);

// Start (or top up) this engagement's compliance obligations on demand — no need to
// mark the engagement "completed" first (fix b).
async function spawnObligations() {
  if (!engagement.value) return;
  spawning.value = true;
  try {
    await spawnCompliance(engagement.value.id);
    compliance.value = await listEngagementCompliance(engagement.value.id);
    await refreshPendingFilings();
    toast.success('Compliance obligations are live.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not start compliance obligations');
  } finally {
    spawning.value = false;
  }
}

async function refreshPendingFilings() {
  try {
    const pending = await listPendingFilings();
    const map: Record<string, ComplianceFiling> = {};
    for (const f of pending) {
      if (f.engagement === id.value && !map[f.obligation]) map[f.obligation] = f;
    }
    pendingByObligation.value = map;
  } catch { /* non-fatal */ }
}

function openFileDialog(o: ComplianceObligation) {
  const f = pendingByObligation.value[o.id];
  if (f) { activeFiling.value = f; fileDialogOpen.value = true; }
}
async function onFiled() {
  compliance.value = await listEngagementCompliance(id.value);
  await refreshPendingFilings();
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

// Compliance obligations spawn server-side when the engagement is completed. The
// lawyer can pause a rolling obligation (stops the recurrence engine touching it)
// or end it entirely.
async function setObligationStatus(o: ComplianceObligation, status: ComplianceStatus) {
  busyObligation.value = o.id;
  try {
    const updated = await updateComplianceStatus(o.id, status);
    const idx = compliance.value.findIndex((x: ComplianceObligation) => x.id === o.id);
    if (idx >= 0) compliance.value[idx] = updated;
  } catch (e: any) {
    toast.error(e?.message || 'Could not update obligation');
  } finally {
    busyObligation.value = '';
  }
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

// Target date is editable post-creation: setting/changing it re-derives the due
// dates (and reminders) of relative-rule milestones server-side, so a lawyer who
// pins the closing date later still gets the reminders the playbook promised.
const targetOpen = ref(false);
const targetDraft = ref('');
const savingTarget = ref(false);

function openTargetEditor() {
  targetDraft.value = engagement.value?.targetDate ? engagement.value.targetDate.slice(0, 10) : '';
  targetOpen.value = true;
}

async function saveTargetDate(clear = false) {
  if (!engagement.value) return;
  savingTarget.value = true;
  try {
    engagement.value = await updateEngagement(engagement.value.id, { targetDate: clear ? '' : targetDraft.value });
    // The server recomputes milestones synchronously on this save; reload them.
    milestones.value = await listMilestones(engagement.value.id);
    targetOpen.value = false;
    toast.success(clear ? 'Target date cleared' : 'Target date updated');
  } catch (e: any) {
    toast.error(e?.message || 'Could not update target date');
  } finally {
    savingTarget.value = false;
  }
}

// Mirror the matter page's back affordance: return to where the user came from,
// falling back to the engagements list.
const goBackOrHome = () => {
  if (window.history.state.back) router.back();
  else router.push('/main/engagements');
};
</script>

<template>
  <!-- Mobile top bar (visible below xs breakpoint) — mirrors the matter page -->
  <div class="flex flex-col w-full xs:hidden">
    <div class="flex flex-row w-full items-center justify-between p-3 gap-3 border-b">
      <Button @click="goBackOrHome" size="icon" variant="outline" aria-label="Go back">
        <ArrowLeft class="size-4"/>
      </Button>

      <div class="flex flex-row relative w-full min-w-0">
        <p
          class="text-lg font-semibold ibm-plex-serif truncate"
          :title="engagement?.name || 'Engagement not found'"
        >
          {{ engagement?.name || 'Engagement not found' }}
        </p>
      </div>

      <div class="flex flex-row gap-2 items-center">
        <SharedDarkModeSwitch/>

        <SharedEngagementsMemberManagement
          v-if="engagement"
          :engagement="engagement"
          @updated="refresh"
        >
          <SharedAvatarStack :members="engagement.expand?.members" :max-visible="3"/>
        </SharedEngagementsMemberManagement>
      </div>
    </div>
  </div>

  <div v-if="loading" class="flex flex-col w-full h-full items-center justify-center">
    <Loader class="animate-spin" />
  </div>

  <div v-else-if="!engagement" class="flex flex-col w-full h-full items-center">
    <div class="flex flex-col w-full lg:flex-row items-center justify-center lg:w-[95vw] h-full lg:border-x lg:divide-x">
      <div class="flex flex-col text-center p-3 items-center gap-2 lg:gap-4 max-w-sm">
        <Briefcase class="size-32 text-muted-foreground mb-5" aria-hidden="true"/>
        <span class="ibm-plex-serif text-2xl lg:text-3xl font-semibold">Engagement Not Found</span>
        <span class="text-muted-foreground">{{ loadError || "The engagement you're looking for doesn't exist or may have been deleted." }}</span>

        <div class="flex gap-2 items-center">
          <Button variant="outline" @click="goBackOrHome"><ChevronLeft /> Go Back</Button>
          <Button @click="router.push('/main/engagements')"><Briefcase /> All engagements</Button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="flex flex-col w-full h-full items-center overflow-y-scroll">
    <div class="flex flex-col w-full lg:flex-row h-full">
      <div class="flex flex-col w-full overflow-y-scroll">
        <!-- Title -->
        <div class="xs:flex flex-col w-full hidden p-3">
          <span class="text-3xl font-semibold ibm-plex-serif">{{ engagement.name }}</span>
          <span v-if="template" class="text-sm ibm-plex-sans text-muted-foreground">{{ template.name }}</span>
        </div>

        <!-- Engagement Controls -->
        <div class="flex flex-row flex-wrap w-full items-center gap-2 p-3">
          <SharedEngagementsMemberManagement
            :engagement="engagement"
            @updated="refresh"
          >
            <Button variant="outline" size="sm" class="gap-2">
              <Users class="size-4"/>
              Assigned Lawyers
              <Badge v-if="(engagement.expand?.members?.length ?? 0) > 0" variant="secondary">
                {{ engagement.expand?.members?.length }}
              </Badge>
            </Button>
          </SharedEngagementsMemberManagement>

          <Select :model-value="engagement.status" :disabled="savingStatus" @update:model-value="(v: any) => setStatus(v as Engagement['status'])">
            <SelectTrigger class="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="s in statusOptions" :key="s" :value="s">{{ s }}</SelectItem>
            </SelectContent>
          </Select>

          <Popover v-model:open="targetOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="gap-2" @click="openTargetEditor">
                <CalendarClock class="size-4" />
                <span v-if="engagement.targetDate">Target {{ new Date(engagement.targetDate).toLocaleDateString() }}</span>
                <span v-else class="text-muted-foreground">Set target date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-64 flex flex-col gap-3" align="start">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Target / closing date</Label>
                <Input v-model="targetDraft" type="date" :disabled="savingTarget" />
                <p class="text-xs text-muted-foreground">Milestone due dates and reminders recalculate from this.</p>
              </div>
              <div class="flex items-center justify-between gap-2">
                <Button
                  v-if="engagement.targetDate"
                  variant="ghost"
                  size="sm"
                  class="text-muted-foreground"
                  :disabled="savingTarget"
                  @click="saveTargetDate(true)"
                >
                  Clear
                </Button>
                <Button size="sm" class="ml-auto" :disabled="savingTarget || !targetDraft" @click="saveTargetDate(false)">
                  <Loader v-if="savingTarget" class="size-4 animate-spin mr-1.5" />
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator />

        <div class="flex flex-row gap-2 p-2 h-full">
          <Tabs class="w-full h-full" v-model="activeTab">
            <TabsList>
              <TabsTrigger class="text-sm ibm-plex-serif font-medium" value="progress">Progress</TabsTrigger>
              <TabsTrigger class="text-sm ibm-plex-serif font-medium" value="documents">Vault</TabsTrigger>
              <TabsTrigger class="text-sm ibm-plex-serif font-medium" value="drafts">Drafted Documents</TabsTrigger>
            </TabsList>

            <!-- Progress — stages, milestones and engagement details -->
            <TabsContent value="progress" class="h-full">
              <Separator />
              <div class="flex flex-col gap-6 p-3 sm:p-4">
              <div v-if="stages.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <ListChecks class="size-4 text-muted-foreground" />
                  <h2 class="text-sm font-medium text-muted-foreground">Stages</h2>
                </div>
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
                <div class="flex items-center justify-between gap-2 mb-3">
                  <h2 class="text-sm font-medium text-muted-foreground">Milestones</h2>
                  <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="openSchedule(null)">
                    <Plus class="size-4" /> Add milestone
                  </Button>
                </div>
                <div v-if="milestones.length === 0" class="text-sm text-muted-foreground">
                  No milestones yet. <button class="text-primary hover:underline" @click="openSchedule(null)">Add one</button> with a due date and reminders.
                </div>
                <div v-else class="flex flex-col gap-2">
                  <Card v-for="m in milestones" :key="m.id" class="p-3 flex flex-row items-center gap-3">
                    <Checkbox
                      :model-value="m.status === 'done'"
                      :disabled="busyMilestone === m.id"
                      @update:model-value="toggleMilestone(m)"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm" :class="{ 'line-through text-muted-foreground': m.status === 'done' }">{{ m.label }}</p>
                      <div class="flex items-center gap-2 flex-wrap">
                        <p v-if="m.dueDate" class="text-xs text-muted-foreground">
                          Due {{ new Date(m.dueDate).toLocaleDateString() }}
                        </p>
                        <p v-else class="text-xs text-muted-foreground/70 italic">No due date</p>
                        <span v-if="m.status === 'pending' && reminderSummary(m)" class="text-xs text-primary flex items-center gap-1">
                          <Bell class="size-3" /> {{ reminderSummary(m) }}
                        </span>
                      </div>
                    </div>
                    <Badge v-if="m.status === 'skipped'" variant="outline">Skipped</Badge>
                    <!-- Set/edit due date + reminders. -->
                    <Button
                      v-if="m.status === 'pending'"
                      variant="ghost" size="icon"
                      class="size-8 shrink-0 text-muted-foreground"
                      :title="m.dueDate ? 'Edit due date & reminders' : 'Set due date & reminders'"
                      @click="openSchedule(m)"
                    >
                      <CalendarPlus class="size-4" />
                    </Button>
                    <!-- Quick reminder on/off for a dated milestone (fix d). -->
                    <Button
                      v-if="m.status === 'pending' && m.dueDate"
                      variant="ghost" size="icon"
                      class="size-8 shrink-0"
                      :class="m.remind ? 'text-primary' : 'text-muted-foreground'"
                      :disabled="busyReminder === m.id"
                      :title="m.remind ? 'Reminder on — click to turn off' : 'Remind me on the due date'"
                      @click="toggleReminder(m)"
                    >
                      <Bell v-if="m.remind" class="size-4" />
                      <BellOff v-else class="size-4" />
                    </Button>
                    <!-- Hard-delete the milestone (vs. marking it skipped). -->
                    <Button
                      variant="ghost" size="icon"
                      class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove this milestone"
                      @click="confirmDeleteMilestone(m)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
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

              <!-- Compliance tail — recurring obligations + the per-occurrence register -->
              <div v-if="compliance.length > 0 || hasComplianceRules">
                <div class="flex items-center justify-between gap-2 mb-3">
                  <div class="flex items-center gap-2">
                    <RefreshCw class="size-4 text-muted-foreground" />
                    <h2 class="text-sm font-medium text-muted-foreground">Recurring compliance</h2>
                  </div>
                  <Button
                    v-if="hasComplianceRules"
                    variant="outline" size="sm" class="h-8 gap-1.5"
                    :disabled="spawning"
                    :title="compliance.length > 0 ? 'Make sure every declared obligation is live' : 'Start this engagement\'s recurring obligations now'"
                    @click="spawnObligations"
                  >
                    <Loader v-if="spawning" class="size-4 animate-spin" />
                    <PlayCircle v-else class="size-4" />
                    {{ compliance.length > 0 ? 'Refresh obligations' : 'Start compliance now' }}
                  </Button>
                </div>

                <p v-if="compliance.length === 0" class="text-sm text-muted-foreground mb-3">
                  This engagement's playbook declares recurring obligations. They start automatically when it's completed —
                  or start them now if the compliance clock is already running.
                </p>

                <div class="flex flex-col gap-2">
                  <Card
                    v-for="o in compliance"
                    :key="o.id"
                    class="p-3 flex flex-row items-center gap-3"
                    :class="{ 'opacity-60': o.status !== 'active' }"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-medium">{{ o.label }}</p>
                        <Badge variant="outline" class="capitalize text-[10px]">{{ o.recurrence }}</Badge>
                        <Badge v-if="o.status !== 'active'" variant="secondary" class="capitalize text-[10px]">{{ o.status }}</Badge>
                      </div>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ o.status === 'ended' ? 'Ended' : 'Next due' }} {{ fmtDate(o.nextDueDate) }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <Button
                        v-if="pendingByObligation[o.id] && o.status === 'active'"
                        variant="outline" size="sm" class="h-8 gap-1.5"
                        :disabled="busyObligation === o.id"
                        title="Record this occurrence as filed"
                        @click="openFileDialog(o)"
                      >
                        <FileCheck2 class="size-4" />
                        <span class="hidden sm:inline">Record filing</span>
                      </Button>
                      <Button
                        v-if="o.status === 'active'"
                        variant="ghost" size="icon" class="size-8 text-muted-foreground"
                        :disabled="busyObligation === o.id"
                        title="Pause this obligation"
                        @click="setObligationStatus(o, 'paused')"
                      >
                        <Pause class="size-4" />
                      </Button>
                      <Button
                        v-else-if="o.status === 'paused'"
                        variant="ghost" size="icon" class="size-8 text-muted-foreground"
                        :disabled="busyObligation === o.id"
                        title="Resume this obligation"
                        @click="setObligationStatus(o, 'active')"
                      >
                        <Play class="size-4" />
                      </Button>
                      <Button
                        v-if="o.status !== 'ended'"
                        variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive"
                        :disabled="busyObligation === o.id"
                        title="End this obligation"
                        @click="setObligationStatus(o, 'ended')"
                      >
                        <X class="size-4" />
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          <!-- Vault — engagement-scoped documents (upload + live ingestion) -->
          <TabsContent value="documents">
            <Separator />
            <div class="flex flex-col gap-3 p-3 sm:p-4">
              <div class="flex items-center gap-2">
                <FolderLock class="size-4 text-muted-foreground" />
                <span class="text-lg font-semibold ibm-plex-serif">Engagement Documents</span>
              </div>
              <p class="text-sm text-muted-foreground -mt-1">
                Upload contracts, correspondence and supporting files. The AI reads them so it can answer questions and
                draft with this engagement's facts.
              </p>
              <SharedVaultBrowser scope="engagement" :scope-id="engagement.id" root-label="Engagement documents" />
            </div>
          </TabsContent>

          <!-- Drafted Documents — AI-generated .docx work product scoped to this engagement -->
          <TabsContent value="drafts">
            <Separator />
            <div class="flex flex-col gap-3 p-3 sm:p-4">
              <div class="flex items-center gap-2">
                <FileType2 class="size-4 text-muted-foreground" />
                <span class="text-lg font-semibold ibm-plex-serif">Drafted Documents</span>
              </div>
              <p class="text-sm text-muted-foreground -mt-1">
                Editable Word drafts the assistant produced for this engagement. Ask the assistant to draft one;
                approved drafts land here.
              </p>
              <SharedDocumentsBrowser :engagement-id="engagement.id" />
            </div>
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>

    <SharedComplianceFileDialog v-model:open="fileDialogOpen" :filing="activeFiling" @filed="onFiled" />

    <SharedEngagementsMilestoneScheduleDialog
      v-model:open="scheduleOpen"
      :engagement-id="engagement.id"
      :milestone="scheduleTarget"
      :stages="stages"
      @saved="onMilestoneSaved"
    />

    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this milestone?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <span class="font-medium">{{ deleteTarget?.label }}</span> and cancels any
            reminder scheduled for it. To keep it on the record instead, mark it skipped. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deletingMilestone">Cancel</AlertDialogCancel>
          <Button variant="destructive" :disabled="deletingMilestone" @click="doDeleteMilestone">
            <Loader v-if="deletingMilestone" class="size-4 animate-spin" />
            Remove
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
