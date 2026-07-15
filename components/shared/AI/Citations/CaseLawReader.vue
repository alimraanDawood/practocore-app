<script setup lang="ts">
// The citation drill-down reader for case-law / legislation citations. Opened from a
// Sources footer or inline citation, it shows the exact verbatim paragraph the claim was
// derived from (highlighted + scrolled into view) inside the whole document, and lets the
// user read the AI-readable markdown or open/download the authoritative original PDF.
//
// It addresses content by the local source id today; the citation also carries a stable
// `globalId` so that when the corpus becomes a centralized service, this same reader can
// resolve against it without changing the citation shape.
import { ref, watch, nextTick, computed, onBeforeUnmount } from 'vue';
import { toast } from 'vue-sonner';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  getSource, getCaseLawMarkdown, caseLawPdfObjectUrl, caseLawPdfBlob, courtLabel,
  type CaseLawDetail,
} from '~/services/caselaw';
import { cleanCitationLabel } from '~/services/ai';

// vue-pdf-embed is heavy (pulls in pdfjs) — load it lazily, client-only.
const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'));

marked.use({ breaks: true, gfm: true });

const props = defineProps<{
  open: boolean;
  sourceId: string;
  anchor?: string;    // the cited paragraph/section, e.g. "para 23" / "s.41"
  citation?: string;  // neutral citation for the header, when known
  title?: string;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

type Tab = 'paragraphs' | 'markdown' | 'pdf';
const tab = ref<Tab>('paragraphs');

const detail = ref<CaseLawDetail | null>(null);
const loading = ref(false);

const markdown = ref('');
const markdownHtml = computed(() =>
  markdown.value ? DOMPurify.sanitize(marked.parse(markdown.value) as string) : '');
const markdownLoaded = ref(false);

// ── PDF viewer state ──────────────────────────────────────────────────────────
const pdfUrl = ref('');           // object URL for the downloaded blob
const pdfLoading = ref(false);
const pdfProgress = ref(0);       // 0..1 download progress
const pdfIndeterminate = ref(false);
const pdfError = ref('');
const pdfPage = ref(1);           // 1-based current page (paged view) / scroll position indicator
const pdfPageCount = ref(0);
const pdfZoom = ref(1);           // 0.5 .. 3
const pdfHost = ref<HTMLElement | null>(null);

// Continuous scroll (all pages stacked, like a normal PDF reader) is the default —
// "click next" paging is opt-in and remembered per-browser.
const PDF_MODE_KEY = 'practoai_citation_pdf_mode';
type PdfMode = 'scroll' | 'paged';
const pdfMode = ref<PdfMode>('scroll');
if (import.meta.client) {
  try {
    const saved = localStorage.getItem(PDF_MODE_KEY);
    if (saved === 'scroll' || saved === 'paged') pdfMode.value = saved;
  } catch { /* noop */ }
}
// A page to jump to once the (re-)render triggered by a mode switch or a
// goPage() call in scroll mode has produced its canvases.
let pendingPdfScrollPage: number | null = null;

function setPdfMode(mode: PdfMode) {
  if (pdfMode.value === mode) return;
  pdfMode.value = mode;
  try { localStorage.setItem(PDF_MODE_KEY, mode); } catch { /* noop */ }
  // Switching modes re-renders the PDF (single canvas <-> all canvases) — carry
  // the current page across so the reader doesn't jump back to the top.
  if (mode === 'scroll') pendingPdfScrollPage = pdfPage.value;
}

function onPdfLoaded(doc: any) {
  pdfPageCount.value = doc?.numPages ?? 0;
  pdfPage.value = Math.min(pdfPage.value, pdfPageCount.value || 1);
}
function onPdfRendered() {
  if (pdfMode.value !== 'scroll' || pendingPdfScrollPage == null) return;
  const page = pendingPdfScrollPage;
  pendingPdfScrollPage = null;
  scrollToPdfPage(page, false);
}
function scrollToPdfPage(page: number, smooth = true) {
  nextTick(() => {
    const el = pdfHost.value?.querySelectorAll<HTMLElement>('.vue-pdf-embed__page')?.[page - 1];
    el?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  });
}
function goPage(delta: number) {
  const next = pdfPage.value + delta;
  if (next < 1 || next > (pdfPageCount.value || 1)) return;
  pdfPage.value = next;
  if (pdfMode.value === 'scroll') scrollToPdfPage(next);
}
// In scroll mode, keep the page indicator (and prev/next bounds) in sync with
// what's actually in view — the page whose top has scrolled past the container's.
let pdfScrollRaf = 0;
function onPdfScroll(e: Event) {
  if (pdfMode.value !== 'scroll' || pdfScrollRaf) return;
  pdfScrollRaf = requestAnimationFrame(() => {
    pdfScrollRaf = 0;
    const container = e.target as HTMLElement;
    const pages = pdfHost.value?.querySelectorAll<HTMLElement>('.vue-pdf-embed__page');
    if (!container || !pages?.length) return;
    const containerTop = container.getBoundingClientRect().top;
    let current = 1;
    pages.forEach((el, i) => {
      if (el.getBoundingClientRect().top - containerTop <= 100) current = i + 1;
    });
    pdfPage.value = current;
  });
}
function zoomBy(delta: number) {
  pdfZoom.value = Math.min(3, Math.max(0.5, +(pdfZoom.value + delta).toFixed(2)));
}

const paraRefs = new Map<string, HTMLElement>();
function setParaRef(anchor: string, el: any) {
  if (el) paraRefs.set(anchor, el as HTMLElement);
}

const header = computed(() =>
  props.title || detail.value?.title || props.citation || detail.value?.citation || 'Judgment');

function isCited(anchor: string): boolean {
  return !!props.anchor && anchor.trim().toLowerCase() === props.anchor.trim().toLowerCase();
}

async function load() {
  loading.value = true;
  detail.value = null;
  markdown.value = '';
  markdownLoaded.value = false;
  revokePdf();
  tab.value = 'paragraphs';
  try {
    detail.value = await getSource(props.sourceId);
    // Jump to the cited paragraph once rendered.
    await nextTick();
    scrollToCited();
  } catch {
    toast.error("That judgment isn't available to you.");
  } finally {
    loading.value = false;
  }
}

function scrollToCited() {
  if (!props.anchor) return;
  const el = paraRefs.get(props.anchor.trim());
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function showMarkdown() {
  tab.value = 'markdown';
  if (markdownLoaded.value) return;
  try {
    markdown.value = (await getCaseLawMarkdown(props.sourceId)).markdown;
  } catch {
    toast.error('Markdown is not available for this source.');
    tab.value = 'paragraphs';
    return;
  }
  markdownLoaded.value = true;
}

async function showPdf() {
  tab.value = 'pdf';
  if (pdfUrl.value) return;
  pdfLoading.value = true;
  pdfError.value = '';
  pdfProgress.value = 0;
  pdfIndeterminate.value = false;
  try {
    const blob = await caseLawPdfBlob(props.sourceId, (fraction, ind) => {
      pdfIndeterminate.value = ind;
      if (!ind) pdfProgress.value = fraction;
    });
    pdfUrl.value = URL.createObjectURL(blob);
  } catch (e: any) {
    pdfError.value = e?.message || 'The original PDF could not be retrieved.';
  } finally {
    pdfLoading.value = false;
  }
}

async function downloadPdf() {
  try {
    const url = await caseLawPdfObjectUrl(props.sourceId, true);
    const a = document.createElement('a');
    a.href = url;
    a.download = (detail.value?.citation || detail.value?.title || 'judgment') + '.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    toast.error('Download failed.');
  }
}

function revokePdf() {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value);
    pdfUrl.value = '';
  }
  pdfError.value = '';
  pdfPage.value = 1;
  pdfPageCount.value = 0;
  pdfZoom.value = 1;
  pendingPdfScrollPage = null;
}
onBeforeUnmount(revokePdf);

watch(() => props.open, (o) => { if (o && props.sourceId) load(); });
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
      <SheetHeader class="border-b p-4">
        <SheetTitle class="pr-6 text-base">{{ cleanCitationLabel(header) }}</SheetTitle>
        <SheetDescription class="flex flex-wrap items-center gap-x-2 text-xs">
          <span v-if="detail?.citation">{{ detail.citation }}</span>
          <span v-if="detail?.court">· {{ courtLabel(detail.court) }}</span>
          <span v-if="detail?.decision_date">· {{ detail.decision_date }}</span>
        </SheetDescription>

        <!-- View switch + original -->
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" :variant="tab === 'paragraphs' ? 'default' : 'outline'" @click="tab = 'paragraphs'">
            <Icon name="lucide:quote" class="size-3.5" /> Paragraphs
          </Button>
          <Button v-if="detail?.has_markdown !== false" size="sm" :variant="tab === 'markdown' ? 'default' : 'outline'" @click="showMarkdown">
            <Icon name="lucide:file-text" class="size-3.5" /> Markdown
          </Button>
          <Button v-if="detail?.has_pdf !== false" size="sm" :variant="tab === 'pdf' ? 'default' : 'outline'" @click="showPdf">
            <Icon name="lucide:file" class="size-3.5" /> PDF
          </Button>
          <Button v-if="detail?.has_pdf !== false" size="sm" variant="ghost" @click="downloadPdf" title="Download the original PDF">
            <Icon name="lucide:download" class="size-3.5" />
          </Button>
          <a v-if="detail?.source_url" :href="detail.source_url" target="_blank" rel="noopener" class="ml-auto">
            <Button size="sm" variant="ghost"><Icon name="lucide:external-link" class="size-3.5" /> ULII</Button>
          </a>
        </div>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div v-if="loading" class="flex justify-center py-12">
          <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-foreground" />
        </div>

        <!-- Verbatim paragraphs, cited one highlighted -->
        <div v-else-if="tab === 'paragraphs' && detail" class="space-y-3">
          <p v-if="anchor" class="text-xs text-muted-foreground">
            Cited at <span class="font-medium text-foreground">{{ anchor }}</span> — highlighted below.
          </p>
          <div
            v-for="p in detail.paragraphs" :key="p.id"
            :ref="(el) => setParaRef(p.anchor, el)"
            :class="['scroll-mt-4 rounded-md border-l-2 py-1 pl-3 transition-colors',
                     isCited(p.anchor) ? 'border-primary bg-primary/5' : 'border-muted']"
          >
            <div class="mb-0.5 text-[11px] font-medium text-primary">{{ p.anchor }}</div>
            <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ cleanCitationLabel(p.text) }}</p>
          </div>
        </div>

        <!-- Rendered markdown -->
        <div
          v-else-if="tab === 'markdown'"
          class="prose prose-pink prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-pre:bg-muted prose-pre:text-foreground"
          v-html="markdownHtml"
        />

        <!-- Original PDF -->
        <div v-else-if="tab === 'pdf'" class="flex h-full min-h-0 flex-col">
          <!-- Download progress -->
          <div v-if="pdfLoading" class="flex flex-col items-center justify-center gap-3 py-12">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="lucide:loader-circle" class="size-4 animate-spin" />
              {{ pdfIndeterminate ? 'Loading PDF…' : `Loading PDF… ${Math.round(pdfProgress * 100)}%` }}
            </div>
            <Progress v-if="!pdfIndeterminate" :model-value="Math.round(pdfProgress * 100)" class="w-56" />
            <div v-else class="h-2 w-56 overflow-hidden rounded-full bg-primary/20">
              <div class="h-full w-1/2 rounded-full bg-primary animate-pulse" />
            </div>
          </div>

          <!-- Error -->
          <div v-else-if="pdfError" class="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Icon name="lucide:triangle-alert" class="size-6 text-destructive" />
            <p class="text-sm font-medium">Couldn't load the PDF</p>
            <p class="max-w-xs text-xs text-muted-foreground">{{ pdfError }}</p>
            <Button size="sm" variant="outline" @click="downloadPdf">
              <Icon name="lucide:download" class="size-3.5" /> Download instead
            </Button>
          </div>

          <!-- Rendered PDF with page + zoom tools -->
          <template v-else-if="pdfUrl">
            <!-- Toolbar -->
            <div class="mb-2 flex shrink-0 flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5">
              <Button size="icon-sm" variant="ghost" :disabled="pdfPage <= 1" title="Previous page" @click="goPage(-1)">
                <Icon name="lucide:chevron-left" class="size-4" />
              </Button>
              <span class="min-w-20 text-center text-xs tabular-nums text-muted-foreground">
                Page {{ pdfPage }} / {{ pdfPageCount || '…' }}
              </span>
              <Button size="icon-sm" variant="ghost" :disabled="pdfPage >= pdfPageCount" title="Next page" @click="goPage(1)">
                <Icon name="lucide:chevron-right" class="size-4" />
              </Button>
              <div class="mx-1 h-4 w-px bg-border" />
              <Button size="icon-sm" variant="ghost" :disabled="pdfZoom <= 0.5" title="Zoom out" @click="zoomBy(-0.25)">
                <Icon name="lucide:zoom-out" class="size-4" />
              </Button>
              <span class="min-w-10 text-center text-xs tabular-nums text-muted-foreground">{{ Math.round(pdfZoom * 100) }}%</span>
              <Button size="icon-sm" variant="ghost" :disabled="pdfZoom >= 3" title="Zoom in" @click="zoomBy(0.25)">
                <Icon name="lucide:zoom-in" class="size-4" />
              </Button>
              <div class="mx-1 h-4 w-px bg-border" />
              <Button
                size="icon-sm" :variant="pdfMode === 'scroll' ? 'secondary' : 'ghost'"
                title="Continuous scroll" @click="setPdfMode('scroll')"
              >
                <Icon name="lucide:scroll-text" class="size-4" />
              </Button>
              <Button
                size="icon-sm" :variant="pdfMode === 'paged' ? 'secondary' : 'ghost'"
                title="One page at a time" @click="setPdfMode('paged')"
              >
                <Icon name="lucide:file" class="size-4" />
              </Button>
            </div>

            <!-- Page canvas(es) (fit width; zoom widens the wrapper so it scrolls) -->
            <div class="min-h-0 flex-1 overflow-auto rounded border bg-muted/30 p-3" @scroll="onPdfScroll">
              <ClientOnly>
                <div
                  ref="pdfHost"
                  class="mx-auto [&_canvas]:!h-auto [&_canvas]:!w-full"
                  :style="{ width: `${pdfZoom * 100}%`, maxWidth: pdfZoom === 1 ? '42rem' : 'none' }"
                >
                  <VuePdfEmbed
                    :source="pdfUrl" :page="pdfMode === 'paged' ? pdfPage : undefined"
                    @loaded="onPdfLoaded" @rendered="onPdfRendered"
                  />
                </div>
                <template #fallback>
                  <div class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Icon name="lucide:loader-circle" class="size-4 animate-spin" /> Rendering PDF…
                  </div>
                </template>
              </ClientOnly>
            </div>
          </template>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
