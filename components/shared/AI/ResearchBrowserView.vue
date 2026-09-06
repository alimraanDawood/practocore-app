<script setup lang="ts">
import {
  ArrowLeft, ArrowRight, BookOpenText, ExternalLink, Globe2, Loader2,
  RefreshCw, Search, Sparkles, TriangleAlert, WandSparkles,
} from 'lucide-vue-next';
import { openUrl } from '@tauri-apps/plugin-opener';
import DOMPurify from 'dompurify';
import { toast } from 'vue-sonner';
import {
  normalizeResearchUrl, resolveResearchPage, type ResearchBrowserState,
} from '~/services/research-browser';

const props = defineProps<{ label: string; initialUrl?: string; suspended?: boolean }>();
const emit = defineEmits<{ state: [state: ResearchBrowserState]; action: [prompt: string] }>();

type ViewMode = 'idle' | 'iframe' | 'reader' | 'pdf' | 'external';
const frame = ref<HTMLIFrameElement | null>(null);
const reader = ref<HTMLElement | null>(null);
const viewMode = ref<ViewMode>('idle');
const frameUrl = ref('');
const frameKey = ref(0);
const readerHtml = ref('');
const pdfUrl = ref('');
const message = ref('');
const address = ref(props.initialUrl || '');
const current = ref<ResearchBrowserState>({
  url: props.initialUrl || '', title: titleFromUrl(props.initialUrl || ''), selection: '',
});
const history = ref<string[]>([]);
const historyIndex = ref(-1);
const loading = ref(false);
let pollTimer: number | null = null;
let requestId = 0;

const started = computed(() => viewMode.value !== 'idle');
const canGoBack = computed(() => historyIndex.value > 0);
const canGoForward = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1);

function titleFromUrl(value: string) {
  if (!value) return 'Web page';
  try { return new URL(value).hostname.replace(/^www\./, '') || 'Web page'; }
  catch { return 'Web page'; }
}

function publish(state: ResearchBrowserState) {
  current.value = state;
  emit('state', state);
}

function revokePdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
  pdfUrl.value = '';
}

function resetContent() {
  revokePdf();
  frameUrl.value = '';
  readerHtml.value = '';
  message.value = '';
}

function extractReaderDocument(raw: string, baseUrl: string) {
  const parsed = new DOMParser().parseFromString(raw, 'text/html');
  const title = parsed.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || parsed.querySelector('title')?.textContent?.trim()
    || titleFromUrl(baseUrl);

  parsed.querySelectorAll('script,style,noscript,svg,canvas,nav,header,footer,aside,form,dialog,[hidden],[aria-hidden="true"]')
    .forEach(node => node.remove());
  const candidates = Array.from(parsed.querySelectorAll<HTMLElement>('article,main,[role="main"]'));
  const source = candidates.sort((a, b) => (b.textContent?.length || 0) - (a.textContent?.length || 0))[0]
    || parsed.body;

  source.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    try { anchor.href = new URL(anchor.getAttribute('href') || '', baseUrl).toString(); }
    catch { anchor.removeAttribute('href'); }
  });
  source.querySelectorAll('img,picture,video,audio,iframe,object,embed').forEach(node => node.remove());

  const html = DOMPurify.sanitize(source.innerHTML, {
    ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'dd', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'],
    ALLOWED_ATTR: ['href'],
  });
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const text = (holder.innerText || holder.textContent || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, html, text };
}

function useIframe(url: string) {
  viewMode.value = 'iframe';
  frameUrl.value = url;
  publish({ url, title: titleFromUrl(url), selection: '' });
}

async function load(value: string, record = true, forceReader = false) {
  const target = normalizeResearchUrl(value);
  if (!target) return;
  if (record) {
    history.value = history.value.slice(0, historyIndex.value + 1);
    history.value.push(target);
    historyIndex.value = history.value.length - 1;
  }

  const thisRequest = ++requestId;
  address.value = target;
  loading.value = true;
  resetContent();
  viewMode.value = 'idle';
  publish({ url: target, title: titleFromUrl(target), selection: '' });

  try {
    const result = await resolveResearchPage(target, forceReader);
    if (thisRequest !== requestId) return;
    address.value = result.url;

    if (result.mode === 'iframe') {
      useIframe(result.url);
    } else if (result.mode === 'reader' && result.body) {
      const page = extractReaderDocument(result.body, result.url);
      if (!page.text) throw new Error('No readable text was found on this page.');
      viewMode.value = 'reader';
      readerHtml.value = page.html;
      message.value = result.reason || '';
      publish({
        url: result.url, title: page.title, selection: '',
        text: page.text.slice(0, 30_000), truncated: page.text.length > 30_000,
      });
    } else if (result.mode === 'pdf' && result.bytes?.length) {
      const bytes = Uint8Array.from(result.bytes);
      pdfUrl.value = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      viewMode.value = 'pdf';
      message.value = result.reason || '';
      publish({ url: result.url, title: titleFromUrl(result.url), selection: '' });
    } else {
      viewMode.value = 'external';
      message.value = result.reason || 'This page could not be shown inside PractoCore.';
    }
  } catch (error: any) {
    if (thisRequest !== requestId) return;
    if (!forceReader) {
      // A failed probe must not prevent an otherwise usable site from loading.
      useIframe(target);
    } else {
      viewMode.value = 'external';
      message.value = error?.message || 'Reader mode could not load this page.';
    }
  } finally {
    if (thisRequest === requestId) loading.value = false;
  }
}

function navigate() { load(address.value); }

function go(direction: 'back' | 'forward') {
  const next = historyIndex.value + (direction === 'back' ? -1 : 1);
  const target = history.value[next];
  if (!target) return;
  historyIndex.value = next;
  load(target, false);
}

function reload() {
  if (!current.value.url) return;
  if (viewMode.value === 'iframe') {
    loading.value = true;
    frameKey.value += 1;
    return;
  }
  load(current.value.url, false, viewMode.value === 'reader' || viewMode.value === 'pdf');
}

function openReader() {
  if (current.value.url) load(current.value.url, false, true);
}

function readSelection() {
  if (viewMode.value === 'iframe') {
    try {
      const doc = frame.value?.contentDocument;
      const win = frame.value?.contentWindow;
      if (!doc || !win) return;
      const selection = (win.getSelection?.()?.toString() || '').trim().slice(0, 12_000);
      const text = (doc.body?.innerText || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      publish({ url: frameUrl.value, title: doc.title || titleFromUrl(frameUrl.value), selection, text: text.slice(0, 30_000), truncated: text.length > 30_000 });
    } catch { /* Expected for cross-origin iframe pages. */ }
    return;
  }
  if (viewMode.value !== 'reader' || !reader.value) return;
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  const selectedText = anchor && reader.value.contains(anchor)
    ? (selection?.toString() || '').trim().slice(0, 12_000)
    : '';
  if (selectedText !== current.value.selection) publish({ ...current.value, selection: selectedText });
}

function onFrameLoad() {
  loading.value = false;
  readSelection();
}

function onReaderClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!anchor?.href) return;
  event.preventDefault();
  load(anchor.href);
}

function selectedAction(task: 'ask' | 'summarise' | 'explain') {
  if (!current.value.selection) return;
  const prompts = {
    ask: 'Help me analyse the selected passage from this web page.',
    summarise: 'Summarise the selected passage and identify its legally significant points.',
    explain: 'Explain the selected passage in plain language and note any legal implications.',
  };
  emit('action', prompts[task]);
}

async function openExternally() {
  if (!current.value.url) return;
  try { await openUrl(current.value.url); }
  catch { toast.error('Could not open this page in the default browser.'); }
}

function resetTab() {
  requestId += 1;
  resetContent();
  history.value = [];
  historyIndex.value = -1;
  viewMode.value = 'idle';
  address.value = props.initialUrl || '';
  if (props.initialUrl) load(props.initialUrl);
}

watch(() => props.label, resetTab);

onMounted(() => {
  if (props.initialUrl) load(props.initialUrl);
  pollTimer = window.setInterval(readSelection, 500);
});

onBeforeUnmount(() => {
  requestId += 1;
  revokePdf();
  if (pollTimer !== null) window.clearInterval(pollTimer);
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div class="flex h-11 shrink-0 items-center gap-1.5 border-b bg-background px-2">
      <Button size="icon-sm" variant="ghost" title="Back" :disabled="!canGoBack" @click="go('back')"><ArrowLeft /></Button>
      <Button size="icon-sm" variant="ghost" title="Forward" :disabled="!canGoForward" @click="go('forward')"><ArrowRight /></Button>
      <Button size="icon-sm" variant="ghost" title="Reload" :disabled="!started" @click="reload">
        <Loader2 v-if="loading" class="animate-spin" /><RefreshCw v-else />
      </Button>
      <form class="relative min-w-0 flex-1" @submit.prevent="navigate">
        <Globe2 class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="address" aria-label="Web address or search" class="h-8 rounded-md bg-muted/45 pl-8 pr-9 text-xs shadow-none focus-visible:bg-background" placeholder="Search or enter a web address" />
        <button type="submit" class="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="Open"><Search class="size-3.5" /></button>
      </form>
      <Button size="icon-sm" variant="ghost" title="Reader view" :disabled="!current.url || loading" @click="openReader"><BookOpenText /></Button>
      <Button size="icon-sm" variant="ghost" title="Open in default browser" :disabled="!current.url" @click="openExternally"><ExternalLink /></Button>
    </div>

    <div v-if="current.selection" class="flex h-10 shrink-0 items-center gap-1.5 border-b bg-primary/[0.045] px-3">
      <span class="mr-auto min-w-0 truncate text-xs text-muted-foreground">“{{ current.selection }}”</span>
      <Button size="xs" variant="ghost" @click="selectedAction('ask')"><Sparkles /> Ask AI</Button>
      <Button size="xs" variant="ghost" @click="selectedAction('summarise')"><BookOpenText /> Summarise</Button>
      <Button size="xs" variant="ghost" @click="selectedAction('explain')"><WandSparkles /> Explain</Button>
    </div>

    <div class="relative min-h-0 flex-1 bg-muted/20">
      <div v-if="loading && viewMode === 'idle'" class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
        <span class="flex items-center gap-2"><Loader2 class="size-4 animate-spin" /> Opening page…</span>
      </div>

      <iframe
        v-if="viewMode === 'iframe'" v-show="!suspended" ref="frame" :key="frameKey"
        :src="frameUrl" :title="current.title" class="absolute inset-0 size-full border-0 bg-background"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        referrerpolicy="strict-origin-when-cross-origin" @load="onFrameLoad" />

      <div v-else-if="viewMode === 'reader'" class="absolute inset-0 overflow-auto bg-background">
        <div v-if="message" class="sticky top-0 z-10 border-b bg-muted/95 px-5 py-2 text-xs text-muted-foreground backdrop-blur">{{ message }} Showing a clean reader view instead.</div>
        <article
          ref="reader" class="reader-page mx-auto max-w-3xl px-8 py-10 text-[15px] leading-7 text-foreground"
          @click="onReaderClick" v-html="readerHtml" />
      </div>

      <SharedPdfView v-else-if="viewMode === 'pdf' && pdfUrl" :source="pdfUrl" class="absolute inset-0" />

      <div v-else-if="viewMode === 'external'" class="absolute inset-0 grid place-items-center p-8 text-center">
        <div class="max-w-sm">
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-lg border bg-background text-muted-foreground"><TriangleAlert class="size-5" /></div>
          <p class="text-sm font-medium">Open this page externally</p>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ message }}</p>
          <Button size="sm" variant="outline" class="mt-4" @click="openExternally"><ExternalLink /> Open in browser</Button>
        </div>
      </div>

      <div v-else-if="viewMode === 'idle' && !loading" class="absolute inset-0 grid place-items-center p-8 text-center">
        <div class="max-w-sm">
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-lg border bg-background text-muted-foreground"><Globe2 class="size-5" /></div>
          <p class="text-sm font-medium">Open a research page</p>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">Pages that prohibit embedding automatically open in a clean reader view.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reader-page :deep(h1) { margin-bottom: 1.25rem; font-size: 1.875rem; font-weight: 600; letter-spacing: -0.025em; }
.reader-page :deep(h2) { margin: 2rem 0 0.75rem; font-size: 1.5rem; font-weight: 600; letter-spacing: -0.025em; }
.reader-page :deep(h3) { margin: 1.5rem 0 0.5rem; font-size: 1.25rem; font-weight: 600; }
.reader-page :deep(p) { margin: 1rem 0; }
.reader-page :deep(a) { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 4px; }
.reader-page :deep(blockquote) { margin: 1.25rem 0; border-left: 2px solid hsl(var(--border)); padding-left: 1.25rem; color: hsl(var(--muted-foreground)); font-style: italic; }
.reader-page :deep(ul) { margin: 1rem 0; list-style: disc; padding-left: 1.5rem; }
.reader-page :deep(ol) { margin: 1rem 0; list-style: decimal; padding-left: 1.5rem; }
.reader-page :deep(pre) { margin: 1rem 0; overflow: auto; border-radius: 0.375rem; background: hsl(var(--muted)); padding: 1rem; font-size: 0.75rem; }
.reader-page :deep(table) { margin: 1.25rem 0; width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.reader-page :deep(th), .reader-page :deep(td) { border: 1px solid hsl(var(--border)); padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
</style>
