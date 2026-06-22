<script lang="ts" setup>
import { marked } from 'marked';
import { toast } from 'vue-sonner';
import type { AiCitation } from '~/services/ai';
import { getDocument, vaultFileUrl, type VaultDocument } from '~/services/vault';

// Renders an assistant answer with its verification trail: inline [[cite:<id>]]
// markers become numbered citation chips, and a "Sources" footer lists every source
// the turn consulted. Both open the same detail popover; from there a source can be
// opened (vault document preview, in-app matter, or external URL). Marker placement
// is model-driven and best-effort, so unknown ids are dropped silently — the footer
// (built deterministically server-side) is the source of truth.
const props = defineProps<{ content: string; citations?: AiCitation[] }>();

marked.use({ breaks: true, gfm: true });

const citations = computed(() => props.citations ?? []);

// citeId -> 1-based index (matches the footer numbering).
const indexById = computed(() => {
  const map = new Map<string, number>();
  citations.value.forEach((c, i) => map.set(c.citeId, i + 1));
  return map;
});
function byId(id: string): AiCitation | undefined {
  return citations.value.find(c => c.citeId === id);
}

const CITE_RE = /\[\[cite:([\w-]+)\]\]/g;

// Replace markers with inline chip HTML before markdown parsing (marked passes raw
// inline HTML through). Known ids become a clickable <sup>; unknown ids vanish so a
// hallucinated marker never renders.
const html = computed(() => {
  const withChips = props.content.replace(CITE_RE, (_, id: string) => {
    const n = indexById.value.get(id);
    if (!n) return '';
    return `<sup class="ai-cite" data-cite="${id}" role="button" tabindex="0">${n}</sup>`;
  });
  return marked.parse(withChips) as string;
});

// ── Popover ─────────────────────────────────────────────────────────────────────
const active = ref<{ citation: AiCitation; index: number; anchor: DOMRect } | null>(null);

function openFor(c: AiCitation, anchor: DOMRect) {
  active.value = { citation: c, index: indexById.value.get(c.citeId) ?? 0, anchor };
}

// Delegated click on an inline chip inside the v-html prose.
function onProseClick(e: MouseEvent) {
  const el = (e.target as HTMLElement)?.closest('[data-cite]') as HTMLElement | null;
  if (!el) return;
  e.preventDefault();
  const c = byId(el.dataset.cite || '');
  if (c) openFor(c, el.getBoundingClientRect());
}

// ── Open a source ────────────────────────────────────────────────────────────────
const previewDoc = ref<VaultDocument | null>(null);
const previewPage = ref<number | undefined>(undefined);
const loadingDoc = ref(false);

// Parse a "page N" locator into a 1-based page number (heading/quote locators yield
// undefined — we open the doc at the top in that case; precise highlighting is a
// later phase).
function pageFromLocator(locator?: string): number | undefined {
  if (!locator) return undefined;
  const m = /page\s+(\d+)/i.exec(locator);
  return m ? Number(m[1]) : undefined;
}

async function open(c: AiCitation) {
  const meta = c.meta ?? {};
  active.value = null;
  if ((c.kind === 'legal' || c.kind === 'web' || c.kind === 'authority') && meta.url) {
    window.open(meta.url, '_blank', 'noopener');
    return;
  }
  if (c.kind === 'matter' && meta.matterId) {
    navigateTo(`/main/matters/matter/${meta.matterId}`);
    return;
  }
  if (c.kind === 'memory' && meta.sourceDocId) {
    loadingDoc.value = true;
    try {
      const doc = await getDocument(meta.sourceDocId);
      if (!doc) { toast.error("That source document isn't available to you."); return; }
      previewPage.value = pageFromLocator(meta.locator);
      previewDoc.value = doc;
    } finally {
      loadingDoc.value = false;
    }
  }
}
</script>

<template>
  <div>
    <div
      class="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-xs max-w-none [&_.ai-cite]:mx-px [&_.ai-cite]:cursor-pointer [&_.ai-cite]:rounded [&_.ai-cite]:bg-secondary [&_.ai-cite]:px-1 [&_.ai-cite]:font-semibold [&_.ai-cite]:text-secondary-foreground [&_.ai-cite]:no-underline hover:[&_.ai-cite]:bg-secondary/80"
      v-html="html"
      @click="onProseClick"
    />

    <SharedAICitationsSourcesFooter :citations="citations" @select="openFor" />

    <SharedAICitationsCitationPopover
      v-if="active"
      :citation="active.citation"
      :index="active.index"
      :anchor="active.anchor"
      @close="active = null"
      @open="open"
    />

    <!-- Source document preview (vault doc the cited fact was distilled from). -->
    <Teleport to="body">
      <div
        v-if="previewDoc"
        class="fixed inset-0 z-[130] flex"
        @click.self="previewDoc = null"
      >
        <div class="ml-auto flex h-full w-full max-w-2xl z-10 flex-col border-l bg-background shadow-xl">
          <SharedVaultDocumentPreview :doc="previewDoc" :resolve-url="() => vaultFileUrl(previewDoc!)" :initial-page="previewPage" :facts-doc-id="previewDoc.id" @close="previewDoc = null" />
        </div>
        <div class="absolute inset-0 bg-black/40 z-5" @click="previewDoc = null" />
      </div>
    </Teleport>
  </div>
</template>
