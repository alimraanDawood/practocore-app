<script lang="ts" setup>
import { marked } from 'marked';
import {
  Brain, Scale, Folder, Globe, Gavel, BookOpen, Landmark, ExternalLink, FileText, X, type LucideIcon,
} from 'lucide-vue-next';
import type { AiCitation } from '~/services/ai';
import { cleanCitationLabel } from '~/services/ai';

// The body of a citation card — kind icon/label, verbatim snippet, per-kind metadata
// and the "open" action. Rendered inside the desktop floating popover and the mobile
// bottom drawer alike; it only *describes* the source and emits intent, the parent
// owns the actual side effects (document preview / navigation / new tab).
const props = defineProps<{
  citation: AiCitation;
  index: number;
  // Whether to show the header close (X) button — the drawer has its own dismiss affordances.
  showClose?: boolean;
}>();
const emit = defineEmits<{ close: []; open: [citation: AiCitation] }>();

const KIND_META: Record<AiCitation['kind'], { icon: LucideIcon; label: string; tint: string }> = {
  memory: { icon: Brain, label: 'Recalled fact', tint: 'text-violet-500' },
  legal: { icon: Scale, label: 'Legal source', tint: 'text-amber-500' },
  matter: { icon: Folder, label: 'Matter', tint: 'text-sky-500' },
  web: { icon: Globe, label: 'Web result', tint: 'text-emerald-500' },
  authority: { icon: Gavel, label: 'Case law', tint: 'text-indigo-500' },
  legislation: { icon: Landmark, label: 'Legislation', tint: 'text-teal-500' },
  help: { icon: BookOpen, label: 'Help article', tint: 'text-primary' },
};
const meta = computed(() => KIND_META[props.citation.kind] ?? KIND_META.web);

const m = computed(() => props.citation.meta ?? {});

// Corpus provisions carry the OCR's Markdown (e.g. "### **34. Computation of time**").
// The header label is rendered as plain text, so strip the noise; the snippet keeps its
// emphasis but is rendered inline (parseInline ignores block syntax) so **bold**/*italic*
// show properly instead of as literal asterisks. Leading heading hashes are dropped first.
const cleanTitle = computed(() => cleanCitationLabel(props.citation.title));
const snippetHtml = computed(() => {
  const s = (props.citation.snippet || '').replace(/^\s*#{1,6}\s*/gm, '');
  return marked.parseInline(s) as string;
});

// What "open" does, surfaced as the action button label (null = no open action).
const openLabel = computed<string | null>(() => {
  const c = props.citation;
  if (c.kind === 'memory') return m.value.sourceDocId ? 'View source document' : null;
  if (c.kind === 'matter') return m.value.matterId ? 'Open matter' : null;
  // Case-law / legislation: the in-app reader opens at the exact cited passage when we
  // have the source pointer; otherwise fall back to the external source link.
  if (c.kind === 'authority' || c.kind === 'legislation') {
    if (m.value.sourceId) return m.value.anchor ? `View passage (${m.value.anchor})` : 'View in document';
    return m.value.url ? 'Open source' : null;
  }
  if ((c.kind === 'legal' || c.kind === 'web') && m.value.url) return 'Open source';
  if (c.kind === 'help' && m.value.slug) return 'Open help article';
  return null;
});
// External (new-tab) vs in-app. Authority/legislation open the in-app reader when a
// source pointer exists; only the URL fallback is external.
const opensExternally = computed(() => {
  const c = props.citation;
  if (c.kind === 'legal' || c.kind === 'web') return true;
  if ((c.kind === 'authority' || c.kind === 'legislation')) return !m.value.sourceId && !!m.value.url;
  return false;
});

const provenanceLine = computed(() => {
  const p = m.value.provenance;
  if (!p) return '';
  if (p.type === 'user') return `You told the assistant: “${p.ref}”`;
  if (p.type === 'tool') return `From the ${p.ref} tool result`;
  if (p.type === 'document') return p.ref || 'From an uploaded document';
  return p.ref || '';
});

function hostOf(url?: string): string {
  if (!url) return '';
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}
</script>

<template>
  <div class="flex items-start gap-2 border-b px-3 py-2.5">
    <div class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted">
      <component :is="meta.icon" class="size-3.5" :class="meta.tint" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ meta.label }}<span class="opacity-50"> · {{ index }}</span>
      </p>
      <p class="truncate text-sm font-medium leading-tight" :title="cleanTitle">{{ cleanTitle }}</p>
    </div>
    <button v-if="showClose" class="shrink-0 text-muted-foreground hover:text-foreground" @click="emit('close')">
      <X class="size-3.5" />
    </button>
  </div>

  <div class="space-y-2 px-3 py-2.5">
    <!-- eslint-disable-next-line vue/no-v-html — snippet is server-built corpus text rendered as inline markdown -->
    <p v-if="citation.snippet" class="text-xs leading-relaxed text-foreground/90 [&_em]:italic [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1" v-html="snippetHtml" />

    <!-- memory provenance + locator -->
    <template v-if="citation.kind === 'memory'">
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          v-if="m.scope"
          class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >{{ m.scope }}</span>
        <span v-if="m.vaultName" class="text-[11px] text-muted-foreground">{{ m.vaultName }}</span>
      </div>
      <p v-if="provenanceLine" class="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <FileText class="mt-0.5 size-3 shrink-0" />
        <span>{{ provenanceLine }}<span v-if="m.locator"> — {{ m.locator }}</span></span>
      </p>
    </template>

    <!-- case-law authority: neutral citation · court · pinned paragraph -->
    <template v-else-if="citation.kind === 'authority'">
      <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span v-if="m.citation" class="font-medium text-foreground/80">{{ m.citation }}</span>
        <span v-if="m.court">· {{ m.court }}</span>
        <span v-if="m.anchor" class="rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-600 dark:text-indigo-400">{{ m.anchor }}</span>
      </div>
      <p class="text-[10px] italic text-muted-foreground">Verbatim — verify against the judgment.</p>
    </template>

    <!-- legislation: statute · section · verbatim provision (or Act-overview headnote) -->
    <template v-else-if="citation.kind === 'legislation'">
      <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span v-if="m.statute" class="font-medium text-foreground/80">{{ m.statute }}</span>
        <span v-if="m.anchor" class="rounded-full bg-teal-500/10 px-2 py-0.5 text-teal-600 dark:text-teal-400">{{ m.anchor }}</span>
      </div>
      <p v-if="m.anchor" class="text-[10px] italic text-muted-foreground">Verbatim — verify against the Act.</p>
    </template>

    <!-- legal / web url host -->
    <p v-else-if="m.url" class="truncate text-[11px] text-muted-foreground" :title="m.url">
      {{ hostOf(m.url as string) }}
    </p>
  </div>

  <div v-if="openLabel" class="border-t px-3 py-2">
    <button
      class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      @click="emit('open', citation)"
    >
      <component :is="opensExternally ? ExternalLink : FileText" class="size-3.5" />
      {{ openLabel }}
    </button>
  </div>
</template>
