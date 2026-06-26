<script lang="ts" setup>
import { marked } from 'marked';
import {
  Brain, Scale, Folder, Globe, Gavel, ExternalLink, FileText, X, type LucideIcon,
} from 'lucide-vue-next';
import type { AiCitation } from '~/services/ai';
import { cleanCitationLabel } from '~/services/ai';

// Floating detail card for one citation. Anchored to the clicked chip/footer entry
// via a viewport rect and teleported to <body> so it escapes the chat's overflow
// clipping. Self-positions below the anchor (flips above when there isn't room).
// It only *describes* the source and signals intent — the parent (CitedAnswer)
// owns the actual "open" side effects (document preview / navigation / new tab).
const props = defineProps<{
  citation: AiCitation;
  index: number;
  anchor: { top: number; left: number; bottom: number; right: number };
}>();
const emit = defineEmits<{ close: []; open: [citation: AiCitation] }>();

const KIND_META: Record<AiCitation['kind'], { icon: LucideIcon; label: string; tint: string }> = {
  memory: { icon: Brain, label: 'Recalled fact', tint: 'text-violet-500' },
  legal: { icon: Scale, label: 'Legal source', tint: 'text-amber-500' },
  matter: { icon: Folder, label: 'Matter', tint: 'text-sky-500' },
  web: { icon: Globe, label: 'Web result', tint: 'text-emerald-500' },
  authority: { icon: Gavel, label: 'Case law', tint: 'text-indigo-500' },
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
  if ((c.kind === 'legal' || c.kind === 'web' || c.kind === 'authority') && m.value.url) return 'Open source';
  return null;
});
const opensExternally = computed(() =>
  props.citation.kind === 'legal' || props.citation.kind === 'web' || props.citation.kind === 'authority');

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

// ── Positioning ────────────────────────────────────────────────────────────────
const card = ref<HTMLElement | null>(null);
const pos = ref<{ top: number; left: number; placeAbove: boolean }>({ top: -9999, left: -9999, placeAbove: false });
const WIDTH = 320;
const GAP = 6;

function place() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = card.value?.offsetHeight ?? 160;
  let left = Math.min(Math.max(8, props.anchor.left), vw - WIDTH - 8);
  const below = props.anchor.bottom + GAP;
  const placeAbove = below + h > vh - 8 && props.anchor.top - GAP - h > 8;
  const top = placeAbove ? props.anchor.top - GAP - h : below;
  pos.value = { top, left, placeAbove };
}

onMounted(async () => {
  await nextTick();
  place();
  window.addEventListener('resize', place);
  window.addEventListener('scroll', onScrollClose, true);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', onScrollClose, true);
  window.removeEventListener('keydown', onKey);
});
function onScrollClose() { emit('close'); }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close'); }
</script>

<template>
  <Teleport to="body">
    <!-- transparent dismiss layer -->
    <div class="fixed inset-0 z-[120]" @click="emit('close')" />
    <div
      ref="card"
      class="fixed z-[121] w-80 rounded-xl border bg-popover text-popover-foreground shadow-lg"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
      @click.stop
    >
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
        <button class="shrink-0 text-muted-foreground hover:text-foreground" @click="emit('close')">
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
    </div>
  </Teleport>
</template>
