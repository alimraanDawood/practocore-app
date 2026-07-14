<script setup lang="ts">
// Hidden superuser-only admin surface for the Ugandan case-law corpus
// (practocore-backend/ai/caselaw). Curation = add judgments, watch ingestion,
// browse by court/year/case, verify the segmented verbatim paragraphs + derived
// enrichment, and reindex.
//
// This is a STANDALONE admin area, not part of the normal app shell: it renders
// in the `blank` layout and is gated by the `superuser` route middleware (a
// separate `_superusers` session, distinct from the app's `Users` session — see
// services/caselaw). The in-page card below performs that superuser sign-in.
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { toast } from 'vue-sonner';
import {
  type CaseLawSource, type CaseLawDetail, type CaseLawStatus,
  UG_COURTS, courtLabel,
  isSuperuserSignedIn, superuserLogin, superuserLogout,
  listSources, getSource, uploadJudgment, deleteSource, reindex, reindexMemoryEmbeddings,
  sourceFileUrl,
  type CatalogueSyncStatus,
  getCatalogueSync, toggleCatalogueSync, runCatalogueSync,
} from '~/services/caselaw';

definePageMeta({ layout: 'blank', middleware: 'superuser' });

const signedIn = ref(isSuperuserSignedIn());

// ── Superuser sign-in ───────────────────────────────────────────────────────
const email = ref('');
const password = ref('');
const loggingIn = ref(false);
async function doLogin() {
  loggingIn.value = true;
  try {
    await superuserLogin(email.value.trim(), password.value);
    signedIn.value = true;
    password.value = '';
    await refresh();
    startPolling();
    loadSync();
  } catch (e: any) {
    toast.error(e?.message || 'Sign-in failed');
  } finally {
    loggingIn.value = false;
  }
}
function doLogout() {
  superuserLogout();
  signedIn.value = false;
  sources.value = [];
}

// ── Browser ─────────────────────────────────────────────────────────────────
const sources = ref<CaseLawSource[]>([]);
const loading = ref(false);
// reka-ui Select disallows an empty-string SelectItem value, so 'all' is the
// sentinel meaning "no filter".
const filterCourt = ref('all');
const filterStatus = ref<CaseLawStatus | 'all'>('all');
const search = ref('');

async function refresh() {
  loading.value = true;
  try {
    sources.value = await listSources({
      court: filterCourt.value !== 'all' ? filterCourt.value : undefined,
      status: filterStatus.value !== 'all' ? filterStatus.value : undefined,
      q: search.value.trim() || undefined,
    });
  } catch (e: any) {
    toast.error(e?.message || 'Could not load the corpus');
  } finally {
    loading.value = false;
  }
}

// Group by court, then by year (decision date) — the requested organisation.
const grouped = computed(() => {
  const byCourt = new Map<string, Map<string, CaseLawSource[]>>();
  for (const s of sources.value) {
    const court = s.court || 'Uncategorised';
    const year = s.decision_date ? s.decision_date.slice(0, 4) : '—';
    if (!byCourt.has(court)) byCourt.set(court, new Map());
    const byYear = byCourt.get(court)!;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(s);
  }
  // Sort: courts alphabetically, years descending.
  return [...byCourt.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([court, byYear]) => ({
      court,
      years: [...byYear.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([year, items]) => ({ year, items })),
    }));
});

const stats = computed(() => {
  const total = sources.value.length;
  const ingested = sources.value.filter((s) => s.status === 'ingested').length;
  const working = sources.value.filter((s) => s.status === 'pending' || s.status === 'processing').length;
  const failed = sources.value.filter((s) => s.status === 'failed').length;
  const review = sources.value.filter((s) => s.status === 'needs_review').length;
  return { total, ingested, working, failed, review };
});

// Poll while anything is still ingesting (collections have no SDK realtime rules).
let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!signedIn.value) return;
    if (sources.value.some((s) => s.status === 'pending' || s.status === 'processing')) {
      refresh();
    }
    // Keep the sync panel live while it's running (queue fills over time).
    if (sync.value?.enabled) loadSync();
  }, 4000);
}
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });

// ── Upload ──────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null);
const ovCitation = ref('');
const ovCourt = ref('');
const queue = ref<{ name: string; pct: number; status: 'queued' | 'uploading' | 'done' | 'error'; message?: string }[]>([]);
const uploading = ref(false);

function pickFiles() { fileInput.value?.click(); }

async function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  if (!files.length) return;
  await uploadFiles(files);
  (e.target as HTMLInputElement).value = '';
}

async function onDrop(e: DragEvent) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length) await uploadFiles(files);
}

async function uploadFiles(files: File[]) {
  uploading.value = true;
  // Per-file overrides only make sense for a single file.
  const single = files.length === 1;
  queue.value = files.map((f) => ({ name: f.name, pct: 0, status: 'queued' as const }));
  for (let i = 0; i < files.length; i++) {
    const item = queue.value[i];
    item.status = 'uploading';
    try {
      const res = await uploadJudgment(
        files[i],
        single ? { citation: ovCitation.value.trim() || undefined, court: ovCourt.value || undefined } : {},
        (pct) => { item.pct = pct; },
      );
      item.status = 'done';
      item.message = res.message;
    } catch (err: any) {
      item.status = 'error';
      item.message = err?.message || 'Failed';
    }
  }
  uploading.value = false;
  ovCitation.value = '';
  ovCourt.value = '';
  await refresh();
  startPolling();
}

// ── Detail / verify ─────────────────────────────────────────────────────────
const detailOpen = ref(false);
const detail = ref<CaseLawDetail | null>(null);
const detailLoading = ref(false);
const fileUrl = ref('');

async function openDetail(s: CaseLawSource) {
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = null;
  fileUrl.value = '';
  try {
    detail.value = await getSource(s.id);
    fileUrl.value = await sourceFileUrl(detail.value).catch(() => '');
  } catch (e: any) {
    toast.error(e?.message || 'Could not load the judgment');
  } finally {
    detailLoading.value = false;
  }
}

async function removeSource(s: CaseLawSource) {
  if (!confirm(`Delete "${s.citation || s.title}" and all its paragraphs from the corpus?`)) return;
  try {
    await deleteSource(s.id);
    toast.success('Removed from the corpus');
    if (detail.value?.id === s.id) detailOpen.value = false;
    await refresh();
  } catch (e: any) {
    toast.error(e?.message || 'Delete failed');
  }
}

const reindexing = ref(false);
async function doReindex() {
  reindexing.value = true;
  try {
    const r = await reindex();
    toast.success(`Reindexed: ${r.fts_indexed} paragraphs, ${r.embedded} embedded`);
  } catch (e: any) {
    toast.error(e?.message || 'Reindex failed');
  } finally {
    reindexing.value = false;
  }
}

// ── Harvester → corpus catalogue sync ────────────────────────────────────────
const sync = ref<CatalogueSyncStatus | null>(null);
const syncBusy = ref(false);
const courtName = (code: string) => courtLabel(code); // reuse the code→label map

async function loadSync() {
  try {
    sync.value = await getCatalogueSync();
  } catch { /* endpoint 404 when the bridge isn't configured — panel hides */ }
}
async function onToggleSync(on: boolean) {
  syncBusy.value = true;
  try {
    sync.value = await toggleCatalogueSync(on);
    toast.success(on ? 'Corpus sync resumed' : 'Corpus sync paused');
  } catch (e: any) {
    toast.error(e?.message || 'Toggle failed');
    await loadSync();
  } finally {
    syncBusy.value = false;
  }
}
async function doSyncNow() {
  syncBusy.value = true;
  try {
    const r = await runCatalogueSync();
    sync.value = r;
    toast.success(r.imported_now ? `Queued ${r.imported_now} judgment(s)` : 'Up to date — nothing new to queue');
    await refresh();
  } catch (e: any) {
    toast.error(e?.message || 'Sync failed');
  } finally {
    syncBusy.value = false;
  }
}

const reindexingMemory = ref(false);
async function doReindexMemory() {
  reindexingMemory.value = true;
  try {
    const r = await reindexMemoryEmbeddings();
    toast.success(`Re-embedded ${r.embedded} memory record(s)`);
  } catch (e: any) {
    toast.error(e?.message || 'Memory reindex failed');
  } finally {
    reindexingMemory.value = false;
  }
}

function statusColor(s: CaseLawStatus): string {
  return s === 'ingested' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    : s === 'failed' ? 'bg-red-500/15 text-red-600 dark:text-red-400'
    : s === 'needs_review' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
}

// Human label for a status (the raw value has an underscore).
function statusLabel(s: CaseLawStatus): string {
  return s === 'needs_review' ? 'needs review' : s;
}

onMounted(() => {
  if (signedIn.value) { refresh(); startPolling(); loadSync(); }
});
</script>

<template>
  <div class="flex flex-col overflow-y-scroll w-full h-full safe-area-shell">
    <div class="mx-auto  w-full max-w-6xl p-4 md:p-8">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="flex items-center gap-2 text-xl font-semibold">
            <Icon name="lucide:scale" class="size-5 text-primary" />
            Case-law corpus
          </h1>
          <p class="text-sm text-muted-foreground">Curate Ugandan judgments the AI can cite and verify. Superuser only.</p>
        </div>
        <Button v-if="signedIn" variant="ghost" size="sm" @click="doLogout">
          <Icon name="lucide:log-out" class="size-4" /> Sign out
        </Button>
      </div>

      <!-- Superuser gate -->
      <Card v-if="!signedIn" class="mx-auto max-w-md">
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><Icon name="lucide:shield" class="size-4" /> Superuser sign-in</CardTitle>
          <CardDescription>Curation requires PocketBase superuser credentials. Your normal app session stays active.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <Input v-model="email" type="email" placeholder="Superuser email" autocomplete="off" @keyup.enter="doLogin" />
          <Input v-model="password" type="password" placeholder="Password" autocomplete="off" @keyup.enter="doLogin" />
          <Button class="w-full" :disabled="loggingIn || !email || !password" @click="doLogin">
            <Icon v-if="loggingIn" name="lucide:loader-circle" class="size-4 animate-spin" />
            Sign in
          </Button>
        </CardContent>
      </Card>

      <template v-else>
        <!-- Add judgments -->
        <Card class="mb-6">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Add judgments</CardTitle>
            <CardDescription>Drop one or many PDF / DOCX / TXT files. Each is segmented into verbatim paragraphs, embedded, and analysed in the background.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div
                class="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center transition-colors hover:bg-muted/40"
                @click="pickFiles" @dragover.prevent @drop="onDrop"
            >
              <Icon name="lucide:upload-cloud" class="mb-2 size-7 text-muted-foreground" />
              <p class="text-sm font-medium">Click or drop files to add</p>
              <p class="text-xs text-muted-foreground">Scanned PDFs are read with OCR automatically</p>
              <input ref="fileInput" type="file" multiple accept=".pdf,.docx,.txt,.md" class="hidden" @change="onFiles" />
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input v-model="ovCitation" placeholder="Override citation (single file, e.g. [2020] UGSC 1)" />
              <Select v-model="ovCourt">
                <SelectTrigger><SelectValue placeholder="Override court (single file)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in UG_COURTS" :key="c.value" :value="c.value">{{ c.label }} ({{ c.value }})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p class="text-xs text-muted-foreground">Overrides apply only when uploading exactly one file; otherwise metadata is parsed from each document.</p>

            <!-- Upload queue -->
            <div v-if="queue.length" class="space-y-1.5">
              <div v-for="(q, i) in queue" :key="i" class="flex items-center gap-2 text-sm">
                <Icon
                    :name="q.status === 'done' ? 'lucide:check-circle-2' : q.status === 'error' ? 'lucide:x-circle' : 'lucide:loader-circle'"
                    :class="['size-4 shrink-0', q.status === 'done' ? 'text-emerald-500' : q.status === 'error' ? 'text-red-500' : 'animate-spin text-muted-foreground']"
                />
                <span class="truncate">{{ q.name }}</span>
                <span v-if="q.status === 'uploading'" class="text-xs text-muted-foreground">{{ q.pct }}%</span>
                <span v-else-if="q.message" class="truncate text-xs text-muted-foreground">— {{ q.message }}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Harvester → corpus sync -->
        <Card v-if="sync?.configured" class="mb-6">
          <CardHeader class="pb-3">
            <div class="flex items-start justify-between gap-4">
              <div>
                <CardTitle class="text-base">Harvester corpus sync</CardTitle>
                <CardDescription>
                  Ingests judgments the harvester mirrored to S3 — most senior court &amp; newest years first — without storing the PDFs here. Self-paced by the ingestion queue; toggle off to pause anytime (it resumes where it left off).
                </CardDescription>
              </div>
              <Switch :model-value="sync.enabled" :disabled="syncBusy" @update:model-value="onToggleSync" />
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <Badge :variant="sync.enabled ? 'default' : 'secondary'">{{ sync.enabled ? 'Running' : 'Paused' }}</Badge>
              <Badge variant="outline">{{ sync.phase }}</Badge>
              <span v-if="sync.court && sync.court !== '__tail__' && sync.court !== '__other__'" class="text-muted-foreground">
              at <span class="font-medium text-foreground">{{ courtName(sync.court) }}</span>
              <span v-if="sync.year"> · {{ sync.year }}</span>
            </span>
              <span v-else-if="sync.phase === 'tail'" class="text-muted-foreground">caught up — watching for new judgments</span>
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span><span class="font-medium text-foreground">{{ sync.imported }}</span> queued for ingestion</span>
              <span><span class="font-medium text-foreground">{{ sync.skipped }}</span> already in corpus</span>
              <span v-if="sync.last_run">last run {{ new Date(sync.last_run).toLocaleString() }}</span>
            </div>
            <p v-if="sync.last_error" class="text-xs text-red-500">{{ sync.last_error }}</p>
            <div class="flex gap-2">
              <Button variant="outline" size="sm" :disabled="syncBusy || !sync.enabled" @click="doSyncNow" title="Advance the sweep now instead of waiting for the schedule">
                <Icon name="lucide:refresh-cw" :class="['size-4', syncBusy && 'animate-spin']" /> Sync now
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Toolbar -->
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <div class="relative flex-1 min-w-48">
            <Icon name="lucide:search" class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" placeholder="Search title, citation, case number…" class="pl-8" @keyup.enter="refresh" />
          </div>
          <Select v-model="filterCourt">
            <SelectTrigger class="w-44"><SelectValue placeholder="All courts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courts</SelectItem>
              <SelectItem v-for="c in UG_COURTS" :key="c.value" :value="c.value">{{ c.label }}</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterStatus">
            <SelectTrigger class="w-36"><SelectValue placeholder="Any status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="ingested">Ingested</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" :disabled="loading" @click="refresh">
            <Icon name="lucide:refresh-cw" :class="['size-4', loading && 'animate-spin']" />
          </Button>
          <Button variant="outline" size="sm" :disabled="reindexing" @click="doReindex" title="Rebuild the case-law search index and re-embed all paragraphs">
            <Icon name="lucide:database" :class="['size-4', reindexing && 'animate-pulse']" /> Reindex corpus
          </Button>
          <Button variant="outline" size="sm" :disabled="reindexingMemory" @click="doReindexMemory" title="Re-embed AiMemories (vault facts) — run after fixing the embedding key">
            <Icon name="lucide:brain" :class="['size-4', reindexingMemory && 'animate-pulse']" /> Reindex memory
          </Button>
        </div>

        <!-- Stats -->
        <div class="mb-4 flex gap-4 text-xs text-muted-foreground">
          <span>{{ stats.total }} judgments</span>
          <span class="text-emerald-600 dark:text-emerald-400">{{ stats.ingested }} ingested</span>
          <span v-if="stats.working" class="text-amber-600 dark:text-amber-400">{{ stats.working }} processing</span>
          <span v-if="stats.review" class="text-orange-600 dark:text-orange-400">{{ stats.review }} needs review</span>
          <span v-if="stats.failed" class="text-red-600 dark:text-red-400">{{ stats.failed }} failed</span>
        </div>

        <!-- Browser grouped by court → year -->
        <div v-if="!sources.length && !loading" class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No judgments yet. Add some above to start building the corpus.
        </div>

        <div v-for="g in grouped" :key="g.court" class="mb-6">
          <h2 class="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Icon name="lucide:landmark" class="size-4 text-muted-foreground" />
            {{ courtLabel(g.court) }} <span class="text-xs font-normal text-muted-foreground">({{ g.court }})</span>
          </h2>
          <div v-for="y in g.years" :key="y.year" class="mb-2">
            <div class="mb-1 ml-6 text-xs font-medium text-muted-foreground">{{ y.year }}</div>
            <div class="ml-6 space-y-1.5">
              <div
                  v-for="s in y.items" :key="s.id"
                  class="group flex items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary/40"
              >
                <button class="min-w-0 flex-1 text-left" @click="openDetail(s)">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ s.title || s.citation || '(untitled)' }}</span>
                    <Badge v-if="s.ocr" variant="outline" class="shrink-0 text-[10px]">OCR</Badge>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <span v-if="s.citation">{{ s.citation }}</span>
                    <span v-if="s.case_number">· {{ s.case_number }}</span>
                    <span v-if="s.provisions_count">· {{ s.provisions_count }} paras</span>
                  </div>
                </button>
                <span :class="['rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', statusColor(s.status)]">{{ statusLabel(s.status) }}</span>
                <Button variant="ghost" size="icon" class="size-7 opacity-0 group-hover:opacity-100" @click.stop="removeSource(s)">
                  <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Detail / verify sheet -->
      <Sheet v-model:open="detailOpen">
        <SheetContent class="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle class="pr-6">{{ detail?.title || detail?.citation || 'Judgment' }}</SheetTitle>
            <SheetDescription>
              <span v-if="detail?.citation">{{ detail.citation }}</span>
              <span v-if="detail?.court"> · {{ courtLabel(detail.court) }}</span>
              <span v-if="detail?.decision_date"> · {{ detail.decision_date }}</span>
            </SheetDescription>
          </SheetHeader>

          <div v-if="detailLoading" class="flex justify-center py-12 p-3">
            <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-foreground" />
          </div>

          <div v-else-if="detail" class="space-y-5 py-4 p-3">
            <div v-if="detail.error" class="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{{ detail.error }}</div>

            <div class="flex flex-wrap gap-2">
              <a v-if="fileUrl" :href="fileUrl" target="_blank" rel="noopener">
                <Button variant="outline" size="sm"><Icon name="lucide:file-text" class="size-4" /> Open original</Button>
              </a>
              <Badge v-for="subj in detail.subjects" :key="subj" variant="secondary" class="capitalize">{{ subj }}</Badge>
            </div>

            <!-- Derived (clearly flagged) -->
            <div v-if="detail.headnote" class="rounded-lg border bg-muted/30 p-3">
              <div class="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                <Icon name="lucide:sparkles" class="size-3" /> AI summary (derived — not citable)
              </div>
              <p class="text-sm">{{ detail.headnote }}</p>
            </div>

            <div v-if="detail.holdings && detail.holdings.length" class="space-y-2">
              <div class="text-xs font-medium uppercase text-muted-foreground">Holdings (derived)</div>
              <div v-for="(h, i) in detail.holdings" :key="i" class="rounded-md border p-2 text-sm">
                <p>{{ h.statement }}</p>
                <div v-if="h.anchors?.length" class="mt-1 flex flex-wrap gap-1">
                  <span v-for="a in h.anchors" :key="a" class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{{ a }}</span>
                </div>
              </div>
            </div>

            <Separator />

            <!-- Verbatim paragraphs -->
            <div>
              <div class="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                <Icon name="lucide:quote" class="size-3" /> Verbatim paragraphs ({{ detail.paragraphs.length }}) — the citable text
              </div>
              <div class="space-y-3">
                <div v-for="p in detail.paragraphs" :key="p.id" class="border-l-2 border-muted pl-3">
                  <div class="mb-0.5 text-[11px] font-medium text-primary">{{ p.anchor }}</div>
                  <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ p.text }}</p>
                  <p v-if="p.derived_summary" class="mt-1 text-xs italic text-muted-foreground">↳ {{ p.derived_summary }}</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  </div>
</template>
