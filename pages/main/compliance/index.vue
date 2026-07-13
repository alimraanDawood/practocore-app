<script lang="ts" setup>
import { ShieldCheck, Loader2, Search, AlertTriangle, Wand2 } from 'lucide-vue-next';
import {
  listAllCompliance, listPendingFilings, updateComplianceStatus, subscribeCompliance, unsubscribeCompliance,
  type ComplianceObligation, type ComplianceStatus, type ComplianceFiling,
} from '~/services/engagements';

definePageMeta({ layout: 'default' });

const router = useRouter();

const obligations = ref<ComplianceObligation[]>([]);
// The current open occurrence per obligation, so each row can offer "Record filing".
const pendingByObligation = ref<Record<string, ComplianceFiling>>({});
const loading = ref(true);
const loadError = ref('');
const busy = ref('');
const query = ref('');
const showInactive = ref(false);

// Mark-filed dialog state.
const fileDialogOpen = ref(false);
const activeFiling = ref<ComplianceFiling | null>(null);

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    const [obs, pending] = await Promise.all([listAllCompliance(), listPendingFilings()]);
    obligations.value = obs;
    const map: Record<string, ComplianceFiling> = {};
    for (const f of pending) {
      // Earliest-due pending occurrence wins (listPendingFilings is sorted by dueDate).
      if (!map[f.obligation]) map[f.obligation] = f;
    }
    pendingByObligation.value = map;
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load compliance obligations.';
  } finally {
    loading.value = false;
  }
}

function openFileDialog(filing: ComplianceFiling) {
  activeFiling.value = filing;
  fileDialogOpen.value = true;
}
function onFiled() {
  refresh();
}

onMounted(() => {
  refresh();
  subscribeCompliance(() => refresh());
});
onBeforeUnmount(() => { unsubscribeCompliance(); });

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const todayISO = toISO(new Date());

// How far out the next occurrence is, as a short human string.
function dueLabel(o: ComplianceObligation) {
  if (!o.nextDueDate) return '—';
  const due = new Date(o.nextDueDate);
  const days = Math.round((due.getTime() - new Date(todayISO).getTime()) / 86400000);
  const date = due.toLocaleDateString();
  if (days < 0) return `Overdue · ${date}`;
  if (days === 0) return `Due today · ${date}`;
  if (days === 1) return `Due tomorrow · ${date}`;
  if (days <= 45) return `In ${days} days · ${date}`;
  return date;
}
function isOverdue(o: ComplianceObligation) {
  return o.status === 'active' && !!o.nextDueDate && new Date(o.nextDueDate) < new Date(todayISO);
}

const filtered = computed(() => {
  let list = obligations.value;
  if (!showInactive.value) list = list.filter(o => o.status === 'active');
  if (query.value) {
    const q = query.value.toLowerCase();
    list = list.filter(o =>
      o.label?.toLowerCase().includes(q) ||
      o.expand?.engagement?.name?.toLowerCase().includes(q)
    );
  }
  return list;
});

const overdue = computed(() => filtered.value.filter(isOverdue));
const upcoming = computed(() => filtered.value.filter(o => !isOverdue(o)));

async function setStatus(o: ComplianceObligation, status: ComplianceStatus) {
  busy.value = o.id;
  try {
    const updated = await updateComplianceStatus(o.id, status);
    const idx = obligations.value.findIndex((x: ComplianceObligation) => x.id === o.id);
    if (idx >= 0) obligations.value[idx] = updated;
  } catch (e: any) {
    loadError.value = e?.message || 'Could not update obligation.';
  } finally {
    busy.value = '';
  }
}

function openEngagement(o: ComplianceObligation) {
  const id = o.expand?.engagement?.id || o.engagement;
  if (id) router.push(`/main/engagements/${id}`);
}
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto">
    <div class="flex flex-col gap-3 border-b p-3">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold flex items-center gap-2 ibm-plex-serif">
            <SidebarTrigger class="lg:hidden" />
            Compliance Calendar
          </h1>
          <p class="text-sm text-muted-foreground">
            Recurring obligations across every engagement — annual returns, renewals, filings. They roll forward automatically.
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" class="gap-1.5" title="Build a compliance retainer playbook" @click="navigateTo('/main/engagements/studio')">
            <Wand2 class="size-4" />
            <span class="hidden sm:inline">Add a compliance type</span>
          </Button>
          <Button variant="outline" size="sm" :class="{ 'bg-secondary': showInactive }" @click="showInactive = !showInactive">
            {{ showInactive ? 'Hide' : 'Show' }} paused/ended
          </Button>
        </div>
      </div>
      <div class="relative w-full max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
        <Input v-model="query" placeholder="Search obligations or engagements…" class="pl-10" />
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center p-8 text-muted-foreground">
      <Loader2 class="size-5 animate-spin mr-2" /> Loading…
    </div>

    <div v-else-if="loadError" class="text-sm text-destructive p-5">{{ loadError }}</div>

    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
      <ShieldCheck class="size-10 opacity-40" />
      <p class="font-medium text-foreground">No recurring obligations yet</p>
      <p class="text-sm max-w-sm">
        Obligations appear here from any engagement with a compliance tail — a Compliance Retainer starts them the day it
        opens, and transactional playbooks (e.g. Company Incorporation) start theirs on completion, or on demand from the
        engagement's Compliance section.
      </p>
    </div>

    <div v-else class="flex flex-col gap-6 p-3 sm:p-5">
      <!-- Overdue -->
      <div v-if="overdue.length > 0" class="flex flex-col gap-2">
        <div class="flex items-center gap-2 text-destructive">
          <AlertTriangle class="size-4" />
          <h2 class="text-sm font-semibold">Overdue ({{ overdue.length }})</h2>
        </div>
        <SharedComplianceRow
          v-for="o in overdue" :key="o.id" :obligation="o" :filing="pendingByObligation[o.id]" :busy="busy === o.id" overdue :due-label="dueLabel(o)"
          @open="openEngagement(o)" @status="(s) => setStatus(o, s)" @file="openFileDialog" />
      </div>

      <!-- Upcoming / all -->
      <div class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-muted-foreground">{{ overdue.length > 0 ? 'Upcoming' : 'All obligations' }} ({{ upcoming.length }})</h2>
        <SharedComplianceRow
          v-for="o in upcoming" :key="o.id" :obligation="o" :filing="pendingByObligation[o.id]" :busy="busy === o.id" :due-label="dueLabel(o)"
          @open="openEngagement(o)" @status="(s) => setStatus(o, s)" @file="openFileDialog" />
      </div>
    </div>

    <SharedComplianceFileDialog v-model:open="fileDialogOpen" :filing="activeFiling" @filed="onFiled" />
  </div>
</template>
