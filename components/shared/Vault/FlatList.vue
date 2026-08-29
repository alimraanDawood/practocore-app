<script lang="ts" setup>
import {
  Search, Eye, Download, FolderOpen, Trash2, LayoutGrid, List as ListIcon,
  ArrowUpDown, Check, X, FileQuestion,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useMediaQuery } from '@vueuse/core';
import {
  vaultFileUrl, setDocumentTrashed, type VaultDocument, type VaultScope,
} from '~/services/vault';
import { docRow, type VaultRow, type VaultSortKey } from '~/composables/useVaultLibrary';
import { useVaultBrowse, type VaultCategory } from '~/composables/useVaultBrowse';
import { useVaultLibraries } from '~/composables/useVaultLibraries';
import type { VaultAction } from './MenuItems.vue';

// The screens that cut ACROSS libraries: recents, the mime categories and search.
// There is no folder tree here by design — these answer "where is that thing",
// which is exactly the question a hierarchy cannot answer. Every row instead
// carries the library it came from, and "Show in folder" walks back into it.
const props = defineProps<{ mode: VaultCategory | 'search'; query?: string }>();

const { docs, loading, loaded, load } = useVaultBrowse();
const { resolveLibrary, refresh, libraryPath } = useVaultLibraries();

const isTouch = useMediaQuery('(pointer: coarse)');
const view = ref<'list' | 'grid'>('list');
const sortKey = ref<VaultSortKey>('date');
const sortDesc = ref(true);

onMounted(() => {
  refresh();
  try {
    const raw = localStorage.getItem('vault.view.prefs');
    if (raw) {
      const p = JSON.parse(raw);
      if (p.view === 'grid' || p.view === 'list') view.value = p.view;
    }
  } catch { /* ignore */ }
});

watch(() => [props.mode, props.query], () => { load(props.mode, props.query || ''); }, { immediate: true });

/** Which library a document belongs to, resolved for the row's second line. */
function libraryLabel(d: VaultDocument): string {
  return resolveLibrary(d.scope, d.scope_id)?.label || 'Library';
}

const rows = computed<VaultRow[]>(() => {
  const out = docs.value.map((d) => docRow(d, libraryLabel(d)));
  const dir = sortDesc.value ? -1 : 1;
  return out.sort((a, b) => (sortKey.value === 'name'
    ? a.name.localeCompare(b.name) * dir
    : (new Date(a.modified).getTime() - new Date(b.modified).getTime()) * dir));
});

// ── Selection (same model as the explorer, minus moves) ─────────────────────
const keyOf = (r: VaultRow) => `doc:${r.id}`;
const selected = ref(new Set<string>());
const selecting = computed(() => selected.value.size > 0);
let anchor = -1;
const rowByKey = computed(() => new Map(rows.value.map((r) => [keyOf(r), r])));
const selectedRows = computed(() =>
  [...selected.value].map((k) => rowByKey.value.get(k)).filter(Boolean) as VaultRow[]);

function clearSelection() { selected.value = new Set(); anchor = -1; }

function onSelect(row: VaultRow, o: { additive: boolean; range: boolean; index: number }) {
  const next = new Set(selected.value);
  const k = keyOf(row);
  if (o.range && anchor >= 0) {
    const [a, b] = anchor < o.index ? [anchor, o.index] : [o.index, anchor];
    for (let i = a; i <= b; i++) next.add(keyOf(rows.value[i]));
  } else if (o.additive) {
    if (next.has(k)) next.delete(k); else next.add(k);
    anchor = o.index;
  } else { next.clear(); next.add(k); anchor = o.index; }
  selected.value = next;
}

function onLongPress(row: VaultRow, index: number) {
  if (selected.value.has(keyOf(row))) return;
  selected.value = new Set([...selected.value, keyOf(row)]);
  anchor = index;
}

watch(rows, () => {
  if (!selected.value.size) return;
  const live = new Set(rows.value.map(keyOf));
  selected.value = new Set([...selected.value].filter((k) => live.has(k)));
});

// ── Preview ─────────────────────────────────────────────────────────────────
const previewRow = ref<VaultRow | null>(null);
const previewDoc = computed(() => (previewRow.value?.doc as VaultDocument | undefined) || null);
const previewOpen = computed({
  get: () => !!previewRow.value,
  set: (v: boolean) => { if (!v) previewRow.value = null; },
});

function open(row: VaultRow) {
  if (selecting.value) return;
  previewRow.value = row;
}

// Opened straight from a home-screen card: `?open=<id>` previews that document as
// soon as the list it lives in has loaded.
const route = useRoute();
watch([loaded, docs], () => {
  const id = (Array.isArray(route.query.open) ? route.query.open[0] : route.query.open) as string;
  if (!id || previewRow.value) return;
  const d = docs.value.find((x) => x.id === id);
  if (d) previewRow.value = docRow(d, libraryLabel(d));
});

async function download(row: VaultRow) {
  if (!row.doc) return;
  try {
    const url = await vaultFileUrl(row.doc);
    if (!url) { toast.error('No file is available for this document.'); return; }
    window.open(url, '_blank');
  } catch { toast.error('Could not open the file.'); }
}

/**
 * Walk back to where the document actually lives. The ancestor chain isn't known
 * here — only the owning folder id — so we hand the library page a `reveal` and
 * let it rewrite the path once it has the folders. That keeps the round trip to
 * one navigation instead of loading a whole library just to draw a menu item.
 */
function showInFolder(row: VaultRow) {
  const d = row.doc;
  if (!d) return;
  const base = libraryPath({ scope: d.scope as VaultScope, scopeId: d.scope_id });
  navigateTo(d.folder ? `${base}?reveal=${d.folder}` : base);
}

async function trashRows(list: VaultRow[]) {
  if (!list.length) return;
  clearSelection();
  const ids = new Set(list.map((r) => r.id));
  docs.value = docs.value.filter((d) => !ids.has(d.id));
  try {
    for (const r of list) await setDocumentTrashed(r.id, true);
    toast(list.length === 1 ? `“${list[0].name}” moved to the recycle bin` : `${list.length} moved to the recycle bin`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const r of list) await setDocumentTrashed(r.id, false);
          load(props.mode, props.query || '');
        },
      },
    });
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the document.');
    load(props.mode, props.query || '');
  }
}

function actionsFor(row: VaultRow): VaultAction[] {
  const many = selected.value.has(keyOf(row)) && selected.value.size > 1;
  const targets = many ? selectedRows.value : [row];
  const suffix = many ? ` (${targets.length})` : '';
  return [
    { id: 'open', label: 'Preview', icon: Eye, run: () => open(row) },
    { id: 'download', label: `Download${suffix}`, icon: Download, run: () => targets.forEach(download) },
    { id: 'locate', label: 'Show in folder', icon: FolderOpen, divider: true, run: () => showInFolder(row) },
    {
      id: 'trash', label: `Move to recycle bin${suffix}`, icon: Trash2, danger: true, divider: true,
      run: () => trashRows(targets),
    },
  ];
}

const emptyCopy = computed(() => {
  if (props.mode === 'search') {
    return props.query?.trim()
      ? { title: `Nothing matches “${props.query.trim()}”`, body: 'Try part of a filename — search looks at names, not contents.' }
      : { title: 'Search your documents', body: 'Type a filename, or part of one. Every library you can reach is searched at once.' };
  }
  return { title: 'Nothing here yet', body: 'Documents show up here as soon as they are added to any library you can reach.' };
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Sort / view. No filter chips: the screen already IS the filter. -->
    <div v-if="rows.length" class="flex shrink-0 items-center gap-1.5 px-1 pb-2">
      <span class="px-1 text-xs text-muted-foreground">
        {{ rows.length }} document{{ rows.length === 1 ? '' : 's' }}
      </span>
      <span class="ml-auto" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button size="icon-sm" variant="ghost" title="Sort">
            <ArrowUpDown class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem @select="sortKey = 'name'; sortDesc = false">
            Name <Check v-if="sortKey === 'name'" class="ml-auto size-3.5" />
          </DropdownMenuItem>
          <DropdownMenuItem @select="sortKey = 'date'; sortDesc = true">
            Last modified <Check v-if="sortKey === 'date'" class="ml-auto size-3.5" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="icon-sm" variant="ghost"
        :title="view === 'list' ? 'Grid view' : 'List view'"
        @click="view = view === 'list' ? 'grid' : 'list'">
        <component :is="view === 'list' ? LayoutGrid : ListIcon" class="size-4" />
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-24 sm:pb-2">
      <div v-if="loading" class="space-y-1.5">
        <Skeleton v-for="i in 6" :key="i" class="h-12 rounded-lg" />
      </div>

      <div
        v-else-if="!rows.length"
        class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <component :is="mode === 'search' ? Search : FileQuestion" class="size-7 text-muted-foreground/60" />
        <p class="text-sm font-medium">{{ emptyCopy.title }}</p>
        <p class="max-w-xs text-xs text-muted-foreground">{{ emptyCopy.body }}</p>
      </div>

      <div
        v-else
        :class="view === 'list' ? 'space-y-0.5' : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'">
        <SharedVaultEntry
          v-for="(row, i) in rows"
          :key="row.id"
          :row="row"
          :index="i"
          :view="view"
          :actions="actionsFor(row)"
          :selected="selected.has(`doc:${row.id}`)"
          :selecting="selecting"
          @open="open"
          @select="onSelect"
          @longpress="onLongPress" />
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-150" enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150" leave-to-class="translate-y-2 opacity-0">
      <div
        v-if="selecting"
        class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t bg-background/95 px-2 py-2 backdrop-blur
               sm:absolute sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:rounded-xl sm:border sm:px-2 sm:shadow-lg">
        <Button size="icon-sm" variant="ghost" title="Clear selection" @click="clearSelection">
          <X class="size-4" />
        </Button>
        <span class="px-1 text-sm font-medium">{{ selected.size }}</span>
        <span class="ml-auto" />
        <Button size="sm" variant="ghost" class="gap-1.5" @click="selectedRows.forEach(download)">
          <Download class="size-4" /> <span class="hidden sm:inline">Download</span>
        </Button>
        <Button size="sm" variant="ghost" class="gap-1.5 text-destructive hover:text-destructive" @click="trashRows(selectedRows)">
          <Trash2 class="size-4" /> <span class="hidden sm:inline">Delete</span>
        </Button>
      </div>
    </Transition>

    <Sheet v-model:open="previewOpen">
      <SheetContent
        :side="isTouch ? 'bottom' : 'right'"
        class="flex flex-col gap-0 p-0"
        :class="isTouch ? 'h-[92dvh]' : 'w-full sm:max-w-2xl'">
        <SharedVaultDocumentPreview
          v-if="previewDoc"
          :doc="{
            id: previewDoc.id, filename: previewDoc.filename, file: previewDoc.file,
            mime: previewDoc.mime, ocr: previewDoc.ocr,
          }"
          :resolve-url="() => vaultFileUrl(previewDoc!)"
          :facts-doc-id="previewDoc.id"
          @close="previewRow = null" />
      </SheetContent>
    </Sheet>
  </div>
</template>
