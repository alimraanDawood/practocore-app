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
  getSource, getCaseLawMarkdown, caseLawPdfObjectUrl, courtLabel,
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

type Tab = 'paragraphs' | 'markdown' | 'pdf';
const tab = ref<Tab>('paragraphs');

const detail = ref<CaseLawDetail | null>(null);
const loading = ref(false);

const markdown = ref('');
const markdownHtml = computed(() =>
  markdown.value ? DOMPurify.sanitize(marked.parse(markdown.value) as string) : '');
const markdownLoaded = ref(false);
const pdfUrl = ref('');
const pdfLoading = ref(false);

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
  try {
    pdfUrl.value = await caseLawPdfObjectUrl(props.sourceId);
  } catch {
    toast.error('The original PDF could not be retrieved.');
    tab.value = 'paragraphs';
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
        <div v-else-if="tab === 'pdf'" class="h-full">
          <div v-if="pdfLoading" class="flex justify-center py-12">
            <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-foreground" />
          </div>
          <iframe v-else-if="pdfUrl" :src="pdfUrl" class="h-[70vh] w-full rounded border" title="Original PDF" />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
