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
</script>

<template>
  <div
    class="flex flex-col gap-2 p-3 border rounded-lg bg-background"
    :class="{ 'opacity-60': obligation.status !== 'active', 'border-destructive/30': overdue }"
  >
    <div class="flex flex-row items-center gap-3">
      <RefreshCw class="size-4 shrink-0" :class="overdue ? 'text-destructive' : 'text-muted-foreground'" />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-medium">{{ obligation.label }}</p>
          <Badge variant="outline" class="capitalize text-[10px]">{{ obligation.recurrence }}</Badge>
          <Badge v-if="obligation.status !== 'active'" variant="secondary" class="capitalize text-[10px]">{{ obligation.status }}</Badge>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground min-w-0"
            @click="emit('open')"
          >
            <Briefcase class="size-3 shrink-0" />
            <span class="truncate">{{ obligation.expand?.engagement?.name || 'Engagement' }}</span>
          </button>
          <span class="text-xs" :class="overdue ? 'text-destructive font-medium' : 'text-muted-foreground'">· {{ dueLabel }}</span>
        </div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <Button
          v-if="filing && obligation.status === 'active'"
          variant="outline" size="sm" class="h-8 gap-1.5"
          :disabled="busy" title="Record this occurrence as filed"
          @click="emit('file', filing)"
        >
          <FileCheck2 class="size-4" />
          <span class="hidden sm:inline">Record filing</span>
        </Button>
        <Button
          v-if="obligation.status === 'active'"
          variant="ghost" size="icon" class="size-8 text-muted-foreground"
          :disabled="busy" title="Pause"
          @click="emit('status', 'paused')"
        >
          <Pause class="size-4" />
        </Button>
        <Button
          v-else-if="obligation.status === 'paused'"
          variant="ghost" size="icon" class="size-8 text-muted-foreground"
          :disabled="busy" title="Resume"
          @click="emit('status', 'active')"
        >
          <Play class="size-4" />
        </Button>
        <Button
          v-if="obligation.status !== 'ended'"
          variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive"
          :disabled="busy" title="End"
          @click="emit('status', 'ended')"
        >
          <X class="size-4" />
        </Button>
        <Button
          variant="ghost" size="icon" class="size-8 text-muted-foreground"
          title="Filing history"
          @click="toggleHistory"
        >
          <ChevronDown class="size-4 transition-transform" :class="{ 'rotate-180': expanded }" />
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
