<script lang="ts" setup>
import {
  Download, X, Loader2, FileType, FileImage, FileText, FileCode2,
  FileQuestion, TriangleAlert,
} from 'lucide-vue-next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { toast } from 'vue-sonner';
import { vaultFileUrl, type VaultDocument } from '~/services/vault';

// In-app document viewer for a single vault document. Presentational + self-loading:
// given a VaultDocument it resolves the (authenticated, token-signed) file URL,
// picks a viewer by mime/extension, and renders it. Editing is intentionally out
// of scope — read-only preview only. Supported: images, PDF (vue-pdf-embed),
// Markdown + plain text/code (fetched + rendered), and Word .docx (mammoth →
// HTML). Anything else falls back to a "can't preview" empty state. The host
// (Browser.vue) decides the chrome around this — a desktop side panel or a
// mobile sheet — so this component only owns its own title bar + body.
// initialPage (1-based) is an optional jump target — set when opened from a
// citation whose locator is a "page N". After the PDF renders we scroll that page
// into view. Ignored for non-PDF documents.
const props = defineProps<{ doc: VaultDocument; initialPage?: number }>();
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

  // Nothing to download for an unpreviewable type — go straight to the fallback.
  if (kind.value === 'unsupported') { loading.value = false; return; }

  try {
    const signed = await vaultFileUrl(props.doc);
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

// Once the PDF finishes rendering, scroll the requested page into view (citation
// jump). vue-pdf-embed renders one canvas per page in document order, so the
// (initialPage-1)th canvas is the target. Best-effort: out-of-range or no target
// just leaves the view at the top.
function onPdfRendered() {
  const page = props.initialPage;
  if (!page || page < 1 || !pdfHost.value) return;
  nextTick(() => {
    const canvases = pdfHost.value?.querySelectorAll('canvas');
    const target = canvases?.[page - 1];
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

async function download() {
  try {
    const signed = await vaultFileUrl(props.doc);
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

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="min-h-0 flex-1 overflow-auto">
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
          class="prose prose-sm dark:prose-invert mx-auto max-w-3xl prose-headings:font-semibold prose-pre:bg-muted prose-pre:text-foreground"
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
  </div>
</template>
