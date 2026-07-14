<script setup lang="ts">
import { RefreshCw, Briefcase, Pause, Play, X, CheckCircle2, FileCheck2, ChevronDown, Paperclip, CircleAlert } from 'lucide-vue-next';
import {
  listObligationFilings, filingEvidenceUrl,
  type ComplianceObligation, type ComplianceStatus, type ComplianceFiling,
} from '~/services/engagements';

const props = defineProps<{
  obligation: ComplianceObligation;
  filing?: ComplianceFiling | null; // the current pending occurrence, if any
  busy?: boolean;
  overdue?: boolean;
  dueLabel: string;
}>();
const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'status', status: ComplianceStatus): void;
  (e: 'file', filing: ComplianceFiling): void;
}>();

// The occurrence register — lazily loaded the first time the row is expanded, so a
// long obligation history isn't fetched for every row up front.
const expanded = ref(false);
const history = ref<ComplianceFiling[]>([]);
const evidenceUrls = ref<Record<string, string>>({}); // filingId → token-authed download URL
const historyLoaded = ref(false);
const historyLoading = ref(false);

async function toggleHistory() {
  expanded.value = !expanded.value;
  if (expanded.value && !historyLoaded.value) {
    historyLoading.value = true;
    try {
      history.value = await listObligationFilings(props.obligation.id);
      // Evidence URLs need a file token (protected collection) — resolve them once.
      const urls: Record<string, string> = {};
      await Promise.all(history.value.filter(f => f.evidence).map(async (f) => {
        urls[f.id] = await filingEvidenceUrl(f);
      }));
      evidenceUrls.value = urls;
      historyLoaded.value = true;
    } finally {
      historyLoading.value = false;
    }
  }
}

// Let the parent force a reload after a filing is recorded.
function reloadHistory() {
  historyLoaded.value = false;
  if (expanded.value) toggleHistory();
}
defineExpose({ reloadHistory });

function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

// Secondary row actions, defined once so the inline buttons (sm+) and the mobile
// overflow menu stay in sync. `disabled` follows the busy flag for status changes;
// history toggling is always available. `run` fires the same behaviour as before.
const secondaryActions = computed(() => {
  const acts: { key: string; label: string; icon: any; danger?: boolean; disabled?: boolean; run: () => void }[] = [];
  if (props.obligation.status === 'active') {
    acts.push({ key: 'pause', label: 'Pause', icon: Pause, disabled: props.busy, run: () => emit('status', 'paused') });
  } else if (props.obligation.status === 'paused') {
    acts.push({ key: 'resume', label: 'Resume', icon: Play, disabled: props.busy, run: () => emit('status', 'active') });
  }
  if (props.obligation.status !== 'ended') {
    acts.push({ key: 'end', label: 'End', icon: X, danger: true, disabled: props.busy, run: () => emit('status', 'ended') });
  }
  acts.push({ key: 'history', label: 'Filing history', icon: ChevronDown, run: toggleHistory });
  return acts;
});
</script>

<template>
  <div
    class="flex flex-col gap-2 p-3 border rounded-lg bg-background"
    :class="{ 'opacity-60': obligation.status !== 'active', 'border-destructive/30': overdue }"
  >
    <!-- Stacks on mobile (info, then an actions row) and sits side-by-side on sm+. -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
      <!-- Info -->
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <RefreshCw class="mt-0.5 size-4 shrink-0" :class="overdue ? 'text-destructive' : 'text-muted-foreground'" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-medium break-words">{{ obligation.label }}</p>
            <Badge variant="outline" class="capitalize text-[10px]">{{ obligation.recurrence }}</Badge>
            <Badge v-if="obligation.status !== 'active'" variant="secondary" class="capitalize text-[10px]">{{ obligation.status }}</Badge>
          </div>
          <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <button
              type="button"
              class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              @click="emit('open')"
            >
              <Briefcase class="size-3 shrink-0" />
              <span class="truncate">{{ obligation.expand?.engagement?.name || 'Engagement' }}</span>
            </button>
            <span class="text-xs" :class="overdue ? 'text-destructive font-medium' : 'text-muted-foreground'">· {{ dueLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Actions: their own right-aligned row under the content on mobile; inline on sm+. -->
      <div class="flex shrink-0 items-center justify-end gap-1 pl-7 sm:pl-0">
        <!-- Primary action: record a filing. -->
        <Button
          v-if="filing && obligation.status === 'active'"
          variant="outline" size="sm" class="h-8 gap-1.5"
          :disabled="busy" title="Record this occurrence as filed"
          @click="emit('file', filing)"
        >
          <FileCheck2 class="size-4" />
          <span>Record filing</span>
        </Button>

        <Button
          v-for="a in secondaryActions" :key="a.key"
          variant="ghost" size="icon"
          class="size-8 text-muted-foreground"
          :class="a.danger ? 'hover:text-destructive' : ''"
          :disabled="a.disabled" :title="a.label"
          @click="a.run"
        >
          <component
            :is="a.icon" class="size-4"
            :class="a.key === 'history' ? ['transition-transform', { 'rotate-180': expanded }] : ''"
          />
        </Button>
      </div>
    </div>

    <!-- Register: the durable record of each occurrence. -->
    <div v-if="expanded" class="pl-7 pr-1 pb-1">
      <div v-if="historyLoading" class="text-xs text-muted-foreground py-2">Loading history…</div>
      <div v-else-if="history.length === 0" class="text-xs text-muted-foreground py-2">No occurrences recorded yet.</div>
      <ul v-else class="flex flex-col divide-y">
        <li v-for="f in history" :key="f.id" class="flex items-center gap-2 py-1.5 text-xs">
          <CheckCircle2 v-if="f.status === 'filed'" class="size-3.5 text-emerald-600 shrink-0" />
          <CircleAlert v-else-if="f.status === 'missed'" class="size-3.5 text-destructive shrink-0" />
          <RefreshCw v-else class="size-3.5 text-muted-foreground shrink-0" />
          <span class="text-muted-foreground">Due {{ fmt(f.dueDate) }}</span>
          <span
            class="capitalize font-medium"
            :class="{ 'text-emerald-600': f.status === 'filed', 'text-destructive': f.status === 'missed' }"
          >· {{ f.status }}</span>
          <span v-if="f.status === 'filed' && f.filedDate" class="text-muted-foreground">on {{ fmt(f.filedDate) }}</span>
          <span v-if="f.reference" class="text-muted-foreground truncate">· {{ f.reference }}</span>
          <a
            v-if="f.evidence && evidenceUrls[f.id]"
            :href="evidenceUrls[f.id]" target="_blank" rel="noopener"
            class="ml-auto inline-flex items-center gap-1 text-primary hover:underline shrink-0"
          >
            <Paperclip class="size-3" /> Evidence
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>
