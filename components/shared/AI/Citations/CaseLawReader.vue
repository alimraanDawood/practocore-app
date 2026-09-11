<script setup lang="ts">
// The citation drill-down reader for case-law / legislation citations. Opened from a
// Sources footer or inline citation, it shows the exact verbatim paragraph the claim was
// derived from (highlighted + scrolled into view) inside the whole document, and lets the
// user read the AI-readable markdown or open/download the authoritative original PDF.
//
// It addresses content by the local source id today; the citation also carries a stable
// `globalId` so that when the corpus becomes a centralized service, this same reader can
// resolve against it without changing the citation shape.
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { toast } from 'vue-sonner';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  getSource, getCaseLawMarkdown, caseLawPdfObjectUrl, caseLawPdfBlob, courtLabel,
  type CaseLawDetail,
} from '~/services/caselaw';
import { cleanCitationLabel } from '~/services/ai';

marked.use({ breaks: true, gfm: true });

const props = defineProps<{
  open: boolean;
  sourceId: string;
  anchor?: string;    // the cited paragraph/section, e.g. "para 23" / "s.41"
  citation?: string;  // neutral citation for the header, when known
  title?: string;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

type Tab = 'document' | 'markdown' | 'pdf';
const tab = ref<Tab>('document');

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
// Page/zoom/scroll-mode state lives in the shared <SharedPdfView> reader.

const header = computed(() =>
  props.title || detail.value?.title || props.citation || detail.value?.citation || 'Judgment');

async function load() {
  loading.value = true;
  detail.value = null;
  markdown.value = '';
  markdownLoaded.value = false;
  revokePdf();
  tab.value = 'document';
  try {
    detail.value = await getSource(props.sourceId);
  } catch {
    toast.error("That judgment isn't available to you.");
  } finally {
    loading.value = false;
  }
}

async function showMarkdown() {
  tab.value = 'markdown';
  if (markdownLoaded.value) return;
  try {
    markdown.value = (await getCaseLawMarkdown(props.sourceId)).markdown;
  } catch {
    toast.error('Markdown is not available for this source.');
    tab.value = 'document';
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
}
onBeforeUnmount(revokePdf);

watch(() => props.open, (o) => { if (o && props.sourceId) load(); });
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
      <SheetHeader class="border-b p-4">
        <SheetTitle class="pr-6 text-base">{{ cleanCitationLabel(header) }}</SheetTitle>
        <SheetDescription class="flex flex-wrap items-center gap-x-2 text-xs">
          <span v-if="detail?.citation">{{ detail.citation }}</span>
          <span v-if="detail?.cap && detail.cap !== detail.citation">· {{ detail.cap }}</span>
          <span v-if="detail?.court">· {{ courtLabel(detail.court) }}</span>
          <span v-if="detail?.decision_date">· {{ detail.decision_date }}</span>
        </SheetDescription>

        <!-- View switch + original -->
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" :variant="tab === 'document' ? 'default' : 'outline'" @click="tab = 'document'">
            <Icon name="lucide:book-open" class="size-3.5" /> Document
          </Button>
          <Button v-if="detail?.has_markdown !== false" size="sm" :variant="tab === 'markdown' ? 'default' : 'outline'" @click="showMarkdown">
            <Icon name="lucide:file-text" class="size-3.5" /> Extracted text
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

      <div
        class="min-h-0 flex-1 overflow-y-auto"
        :class="tab === 'document' ? 'bg-muted/40' : 'p-4'"
      >
        <div v-if="loading" class="flex justify-center py-12">
          <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-foreground" />
        </div>

        <!-- Structured legal document; citation anchor is highlighted and scrolled into view. -->
        <div v-else-if="tab === 'document' && detail" class="mx-auto min-h-full max-w-[56rem] bg-white shadow-sm">
          <SharedAICitationsLegalDocumentView :detail="detail" :anchor="anchor" />
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
          <SharedPdfView
            v-else-if="pdfUrl"
            :source="pdfUrl"
            max-width="42rem"
            class="min-h-0 flex-1 overflow-hidden rounded border"
          />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
