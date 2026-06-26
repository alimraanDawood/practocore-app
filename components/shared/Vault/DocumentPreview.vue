<script lang="ts" setup>
import {
  Download, X, Loader2, FileType, FileImage, FileText, FileCode2,
  FileQuestion, TriangleAlert, Sparkles, ScanLine, Quote,
} from 'lucide-vue-next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { toast } from 'vue-sonner';
import { getDocumentFacts, type VaultFact } from '~/services/vault';

// In-app document viewer for a single document. Presentational + self-loading:
// given a lightweight descriptor and a `resolveUrl` thunk that returns an
// authenticated/openable file URL, it picks a viewer by mime/extension and renders
// it. Source-agnostic — used both for vault documents (resolveUrl = vaultFileUrl)
// and for AI chat attachments (resolveUrl = a pre-signed token/blob URL). Editing is
// out of scope — read-only preview only. Supported: images, PDF (vue-pdf-embed),
// Markdown + plain text/code (fetched + rendered), and Word .docx (mammoth → HTML).
// Anything else falls back to a "can't preview" empty state. The host decides the
// chrome around this — a desktop side panel or a sheet — so this component only owns
// its own title bar + body.
// initialPage (1-based) is an optional jump target — set when opened from a
// citation whose locator is a "page N". After the PDF renders we scroll that page
// into view. Ignored for non-PDF documents.
export interface PreviewDoc {
  /** Stable identity used as the reload key — changes when a different file opens. */
  id: string;
  filename?: string;
  /** Stored filename, used only as an extension fallback when filename is absent. */
  file?: string;
  mime?: string;
  /** True when the text was recovered by OCR (scanned/image PDF) — badged in the tab bar. */
  ocr?: boolean;
}
const props = defineProps<{
  doc: PreviewDoc;
  /** Returns an openable (token-signed or blob/object) URL for the current doc. */
  resolveUrl: () => Promise<string>;
  initialPage?: number;
  /**
   * When set, a "Facts" tab is shown that loads the AI-distilled facts for this
   * vault document id (the per-document verification trail). Opt-in so the shared
   * preview stays source-agnostic — chat attachments omit it.
   */
  factsDocId?: string;
}>();
const emit = defineEmits<{ close: [] }>();

marked.use({ breaks: true, gfm: true });

type Kind = 'image' | 'pdf' | 'markdown' | 'text' | 'docx' | 'unsupported';

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

// Extensions we render as plain (monospace) text. Markdown is handled separately.
const TEXT_EXTS = new Set([
  'txt', 'text', 'log', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml',
  'html', 'htm', 'js', 'ts', 'css', 'sql', 'ini', 'conf', 'rtf',
]);

const kind = computed<Kind>(() => {
  const mime = (props.doc.mime || '').toLowerCase();
  const e = ext(props.doc.filename || props.doc.file || '');
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(e)) return 'image';
  if (mime === 'application/pdf' || e === 'pdf') return 'pdf';
  if (mime === 'text/markdown' || e === 'md' || e === 'markdown') return 'markdown';
  if (e === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mime.startsWith('text/') || TEXT_EXTS.has(e)) return 'text';
  return 'unsupported';
});

const kindIcon = computed(() => {
  switch (kind.value) {
    case 'image': return FileImage;
    case 'pdf': return FileType;
    case 'text': return FileCode2;
    default: return FileText;
  }
});

// ── Loading ───────────────────────────────────────────────────────────────────
const loading = ref(false);
const error = ref('');
const url = ref('');          // object URL for the downloaded blob (image / pdf)
const textContent = ref('');  // raw text (markdown / text)
const htmlContent = ref('');  // sanitized HTML (markdown rendered / docx converted)
// Download progress (0..1). `indeterminate` is true when the server doesn't send a
// Content-Length, so we can't compute a percentage and show a pulsing bar instead.
const progress = ref(0);
const indeterminate = ref(false);
// Declared here (before load()) so the immediate doc.id watcher, which runs load()
// during setup, doesn't hit a temporal-dead-zone on this ref.
const pdfReady = ref(false);

// Object URLs must be revoked to avoid leaking the downloaded blob in memory.
let objectUrl: string | null = null;
function revokeObjectUrl() {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
}

// Download the file ourselves (via XHR) so we get real byte progress — the signed
// URL already carries a file token, so no auth header is needed. Returns the Blob.
function fetchBlob(signed: string, onProgress: (fraction: number, indeterminate: boolean) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', signed);
    xhr.responseType = 'blob';
    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total, false);
      else onProgress(0, true);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as Blob);
      else reject(new Error(`Could not load the file (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Network error while loading the file.'));
    xhr.send();
  });
}

async function load() {
  revokeObjectUrl();
  loading.value = true;
  error.value = '';
  url.value = '';
  textContent.value = '';
  htmlContent.value = '';
  progress.value = 0;
  indeterminate.value = false;
  pdfReady.value = false;

  // Nothing to download for an unpreviewable type — go straight to the fallback.
  if (kind.value === 'unsupported') { loading.value = false; return; }

  try {
    const signed = await props.resolveUrl();
    if (!signed) { error.value = 'No file is available for this document.'; return; }

    const blob = await fetchBlob(signed, (fraction, ind) => {
      indeterminate.value = ind;
      if (!ind) progress.value = fraction;
    });

    if (kind.value === 'image' || kind.value === 'pdf') {
      objectUrl = URL.createObjectURL(blob);
      url.value = objectUrl;
    } else if (kind.value === 'markdown') {
      htmlContent.value = DOMPurify.sanitize(marked.parse(await blob.text()) as string);
    } else if (kind.value === 'text') {
      textContent.value = await blob.text();
    } else if (kind.value === 'docx') {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
      htmlContent.value = DOMPurify.sanitize(value || '<p><em>This document appears to be empty.</em></p>');
    }
  } catch (e: any) {
    error.value = e?.message || 'Could not load the file.';
  } finally {
    loading.value = false;
  }
}

watch(() => props.doc.id, load, { immediate: true });
onBeforeUnmount(revokeObjectUrl);

// vue-pdf-embed is heavy and pulls in pdfjs — load it lazily, client-only.
const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'));

const pdfHost = ref<HTMLElement | null>(null);
// A page-jump requested before the PDF has rendered (citation deep-link, or a
// fact clicked from the Facts tab) is parked here and applied on @rendered.
let pendingScrollPage: number | null = null;

// Scroll a 1-based page into view. vue-pdf-embed renders one canvas per page in
// document order, so the (page-1)th canvas is the target. Best-effort: out-of-range
// or not-yet-rendered just parks the request (applied on render).
function scrollToPage(page: number) {
  if (!page || page < 1) return;
  if (!pdfReady.value || !pdfHost.value) { pendingScrollPage = page; return; }
  nextTick(() => {
    const target = pdfHost.value?.querySelectorAll('canvas')?.[page - 1];
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

function onPdfRendered() {
  pdfReady.value = true;
  const page = pendingScrollPage ?? props.initialPage ?? 0;
  pendingScrollPage = null;
  if (page) scrollToPage(page);
}

// ── Facts tab (per-document verification trail) ───────────────────────────────
type Tab = 'document' | 'facts';
const activeTab = ref<Tab>('document');
const facts = ref<VaultFact[]>([]);
const factsLoading = ref(false);
const factsError = ref('');
let factsLoaded = false; // lazy: only fetch once the Facts tab is first opened

async function loadFacts() {
  if (!props.factsDocId || factsLoaded) return;
  factsLoaded = true;
  factsLoading.value = true;
  factsError.value = '';
  try {
    const res = await getDocumentFacts(props.factsDocId);
    facts.value = res.facts || [];
  } catch (e: any) {
    factsError.value = e?.message || 'Could not load facts.';
    factsLoaded = false; // allow a retry
  } finally {
    factsLoading.value = false;
  }
}

function selectTab(t: Tab) {
  activeTab.value = t;
  if (t === 'facts') loadFacts();
}

// Reset the facts panel whenever a different document is opened.
watch(() => props.factsDocId, () => {
  facts.value = [];
  factsError.value = '';
  factsLoaded = false;
  activeTab.value = 'document';
});

// Parse a "page 3" locator into its page number (null for clause/quote locators).
function locatorPage(loc?: string): number | null {
  const m = /page\s+(\d+)/i.exec(loc || '');
  return m ? parseInt(m[1], 10) : null;
}

// Clicking a fact jumps the document view to its page (when the locator is a page
// and the file is a PDF). Otherwise it's a no-op label.
function onFactClick(f: VaultFact) {
  const page = locatorPage(f.provenance?.locator);
  if (page && kind.value === 'pdf') {
    selectTab('document');
    scrollToPage(page);
  }
}

function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'High';
  if (c >= 0.6) return 'Medium';
  return 'Low';
}

async function download() {
  try {
    const signed = await props.resolveUrl();
    if (!signed) { toast.error('No file is available for this document.'); return; }
    window.open(signed, '_blank');
  } catch {
    toast.error('Could not open the file.');
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <!-- ── Title bar ──────────────────────────────────────────────────────── -->
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
      <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <component :is="kindIcon" class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium leading-tight" :title="doc.filename">
          {{ doc.filename || 'Document' }}
        </p>
        <p class="truncate text-xs text-muted-foreground">
          {{ doc.mime || 'Unknown type' }}
        </p>
      </div>
      <Button size="sm" variant="outline" class="shrink-0 gap-1.5" @click="download">
        <Download class="size-4" />
        <span class="hidden sm:inline">Download</span>
      </Button>
      <Button size="icon-sm" variant="ghost" class="shrink-0" title="Close preview" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <!-- ── Tab bar (Document | Facts) — only for vault documents ───────────── -->
    <div v-if="factsDocId" class="flex shrink-0 items-center gap-1 border-b px-2">
      <button
        type="button"
        class="relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'document' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab('document')"
      >Document</button>
      <button
        type="button"
        class="relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'facts' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab('facts')"
      >
        <Sparkles class="size-3.5" />
        Facts
        <span v-if="facts.length" class="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{{ facts.length }}</span>
      </button>
      <span
        v-if="doc.ocr"
        class="ml-auto flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-500"
        title="Text was recovered from a scanned document with OCR"
      >
        <ScanLine class="size-3" /> OCR
      </span>
    </div>

    <!-- ── Body: Document tab (kept mounted so page-jumps stay instant) ──────── -->
    <div v-show="activeTab === 'document'" class="min-h-0 flex-1 overflow-auto">
      <!-- Loading (with download progress) -->
      <div v-if="loading" class="flex h-full flex-col items-center justify-center gap-3 p-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" />
          {{ indeterminate ? 'Loading preview…' : `Loading preview… ${Math.round(progress * 100)}%` }}
        </div>
        <Progress v-if="!indeterminate" :model-value="Math.round(progress * 100)" class="w-48" />
        <div v-else class="h-2 w-48 overflow-hidden rounded-full bg-primary/20">
          <div class="h-full w-1/2 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div class="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert class="size-5" />
        </div>
        <p class="text-sm font-medium">Couldn't load this file</p>
        <p class="max-w-xs text-xs text-muted-foreground">{{ error }}</p>
        <Button size="sm" variant="outline" class="gap-1.5" @click="download">
          <Download class="size-4" /> Download instead
        </Button>
      </div>

      <!-- Image -->
      <div v-else-if="kind === 'image'" class="grid h-full place-items-center bg-muted/30 p-4">
        <img :src="url" :alt="doc.filename" class="max-h-full max-w-full object-contain" />
      </div>

      <!-- PDF -->
      <div v-else-if="kind === 'pdf'" ref="pdfHost" class="bg-muted/30 p-3">
        <ClientOnly>
          <VuePdfEmbed :source="url" class="mx-auto max-w-3xl [&_canvas]:!h-auto [&_canvas]:!w-full" @rendered="onPdfRendered" />
          <template #fallback>
            <div class="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 class="size-4 animate-spin" /> Rendering PDF…
            </div>
          </template>
        </ClientOnly>
      </div>

      <!-- Markdown / docx (rendered HTML) -->
      <div v-else-if="kind === 'markdown' || kind === 'docx'" class="p-5">
        <div
          class="prose prose-pink prose-sm dark:prose-invert mx-auto max-w-3xl prose-headings:font-semibold prose-pre:bg-muted prose-pre:text-foreground"
          v-html="htmlContent"
        />
      </div>

      <!-- Plain text / code -->
      <pre
        v-else-if="kind === 'text'"
        class="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-foreground"
      >{{ textContent }}</pre>

      <!-- Unsupported -->
      <div v-else class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion class="size-5" />
        </div>
        <p class="text-sm font-medium">Can't preview this file</p>
        <p class="max-w-xs text-xs text-muted-foreground">
          This file type can't be shown here yet. Download it to open in another app.
        </p>
        <Button size="sm" variant="outline" class="gap-1.5" @click="download">
          <Download class="size-4" /> Download
        </Button>
      </div>
    </div>

    <!-- ── Body: Facts tab (per-document verification trail) ─────────────────── -->
    <div v-if="factsDocId" v-show="activeTab === 'facts'" class="min-h-0 flex-1 overflow-auto">
      <!-- Loading -->
      <div v-if="factsLoading" class="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading facts…
      </div>

      <!-- Error -->
      <div v-else-if="factsError" class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div class="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert class="size-5" />
        </div>
        <p class="text-sm font-medium">Couldn't load facts</p>
        <p class="max-w-xs text-xs text-muted-foreground">{{ factsError }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="!facts.length" class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Sparkles class="size-5" />
        </div>
        <p class="text-sm font-medium">No facts yet</p>
        <p class="max-w-xs text-xs text-muted-foreground">
          The AI hasn't distilled any facts from this document. If it's still ingesting, they'll appear here shortly.
        </p>
      </div>

      <!-- Facts list -->
      <ul v-else class="divide-y">
        <li v-for="f in facts" :key="f.id" class="px-4 py-3">
          <p class="text-sm leading-relaxed text-foreground">{{ f.content }}</p>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button
              v-if="f.provenance?.locator"
              type="button"
              class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
              :class="locatorPage(f.provenance?.locator) && kind === 'pdf' ? 'cursor-pointer' : 'cursor-default'"
              :title="locatorPage(f.provenance?.locator) && kind === 'pdf' ? 'Jump to this page in the document' : undefined"
              @click="onFactClick(f)"
            >
              <Quote class="size-3" /> {{ f.provenance.locator }}
            </button>
            <span
              v-for="t in (f.tags || [])"
              :key="t"
              class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >{{ t }}</span>
            <span class="ml-auto text-[11px] text-muted-foreground" :title="`Confidence: ${Math.round((f.confidence || 0) * 100)}%`">
              {{ confidenceLabel(f.confidence || 0) }} confidence
            </span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
