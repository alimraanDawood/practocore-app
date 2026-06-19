<script lang="ts" setup>
import {
  Folder, FileText, FileType, FileImage, MoreVertical, Check,
  FolderOpen, Download, Pencil, FolderInput, Trash2, TriangleAlert,
  CheckSquare, RotateCcw, Sparkles, EyeOff, Eye,
} from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { docTypeLabel, type VaultEntry } from '~/services/vault';

dayjs.extend(relativeTime);

// One entry (folder or document) in the Nautilus-style explorer. Presentational:
// it renders as a list row or a grid card depending on `view`, exposes a right-
// click context menu + a "⋮" menu, is drag-drop aware (folders are drop targets),
// and supports multi-selection (checkbox on desktop, long-press on touch). All
// actions are delegated upward via emits so Browser.vue owns the dialogs and the
// move/rename/delete/trash logic in one place.
const props = withDefaults(defineProps<{
  entry: VaultEntry;
  view: 'list' | 'grid';
  readonly?: boolean;
  /** This item is the one currently being dragged (dimmed). */
  dragging?: boolean;
  /** A multi-selection is in progress — clicks toggle selection, not open. */
  selectionActive?: boolean;
  /** This item is part of the current selection. */
  selected?: boolean;
  /** Rendering inside the Trash view — actions become Restore / Delete forever. */
  trashView?: boolean;
}>(), {
  readonly: false, dragging: false, selectionActive: false, selected: false, trashView: false,
});

const emit = defineEmits<{
  open: [VaultEntry];
  preview: [VaultEntry];
  download: [VaultEntry];
  rename: [VaultEntry];
  move: [VaultEntry];
  remove: [VaultEntry];
  restore: [VaultEntry];
  purge: [VaultEntry];
  toggleIngest: [VaultEntry];
  toggleSelect: [VaultEntry];
  longpress: [VaultEntry];
  dragstart: [VaultEntry];
  dragend: [];
  dropInto: [VaultEntry];
}>();

const isFolder = computed(() => props.entry.kind === 'folder');

const icon = computed(() => {
  if (isFolder.value) return Folder;
  const m = props.entry.mime || '';
  const n = props.entry.filename || props.entry.name || '';
  if (m.includes('pdf') || n.endsWith('.pdf')) return FileType;
  if (m.startsWith('image/')) return FileImage;
  return FileText;
});

const modified = computed(() => {
  const d = props.entry.modified;
  if (!d) return '';
  const m = dayjs(d);
  return m.isAfter(dayjs().subtract(6, 'day')) ? m.fromNow() : m.format('D MMM YYYY');
});

const subtitle = computed(() => {
  if (props.entry.path) return props.entry.path;
  if (isFolder.value) {
    const c = props.entry.count ?? 0;
    return `${c} item${c === 1 ? '' : 's'}`;
  }
  return '';
});

const typeLabel = computed(() => (isFolder.value ? '' : docTypeLabel(props.entry.docType)));

// Whether to render the selection checkbox: always while a selection is active or
// in the Trash view; otherwise it appears on hover (desktop affordance).
const showCheckbox = computed(() => props.selectionActive || props.trashView);
const canDrag = computed(() => !props.readonly && !props.selectionActive && !props.trashView);

function onPrimary() {
  if (props.selectionActive || props.trashView) { emit('toggleSelect', props.entry); return; }
  if (isFolder.value) emit('open', props.entry);
  else emit('preview', props.entry);
}

// ── Long-press (touch) → enter selection ────────────────────────────────────
let lpTimer: ReturnType<typeof setTimeout> | null = null;
let lpFired = false;
function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' || props.readonly) return; // long-press is a touch affordance
  lpFired = false;
  lpTimer = setTimeout(() => { lpFired = true; emit('longpress', props.entry); }, 450);
}
function cancelLongPress() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }
function onClick() {
  // Swallow the click that follows a long-press so it doesn't also open the item.
  if (lpFired) { lpFired = false; return; }
  onPrimary();
}

// ── Drag-drop ───────────────────────────────────────────────────────────────
// Folders are drop targets; `over` drives the local drop highlight. Browser
// validates the move (self/descendant) and the server enforces it too.
const over = ref(false);
function onDragStart(e: DragEvent) {
  if (!canDrag.value) { e.preventDefault(); return; }
  cancelLongPress();
  e.dataTransfer?.setData('text/plain', `${props.entry.kind}:${props.entry.id}`);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  emit('dragstart', props.entry);
}
function onDragOver(e: DragEvent) {
  if (props.readonly || !isFolder.value || props.dragging || props.trashView) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  over.value = true;
}
function onDrop(e: DragEvent) {
  over.value = false;
  if (props.readonly || !isFolder.value || props.dragging || props.trashView) return;
  e.preventDefault();
  emit('dropInto', props.entry);
}
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        :draggable="canDrag"
        class="group relative cursor-pointer select-none rounded-lg border transition-colors"
        :class="[
          view === 'list' ? 'flex items-center gap-3 px-3 py-2' : 'flex flex-col gap-2 p-3',
          selected
            ? 'border-primary bg-primary/10'
            : over
              ? 'border-primary bg-primary/10 ring-1 ring-primary'
              : 'hover:border-primary/40 hover:bg-accent/40',
          dragging ? 'opacity-40' : '',
        ]"
        @click="onClick"
        @pointerdown="onPointerDown"
        @pointerup="cancelLongPress"
        @pointermove="cancelLongPress"
        @pointerleave="cancelLongPress"
        @dragstart="onDragStart"
        @dragend="emit('dragend')"
        @dragover="onDragOver"
        @dragleave="over = false"
        @drop="onDrop"
      >
        <!-- Selection checkbox -->
        <button
          type="button"
          class="grid size-5 shrink-0 place-items-center rounded border transition-colors"
          :class="[
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40 bg-background',
            showCheckbox ? 'flex' : 'hidden group-hover:flex',
            view === 'grid' ? 'absolute left-2 top-2 z-10' : '',
          ]"
          @click.stop="emit('toggleSelect', entry)"
        >
          <Check v-if="selected" class="size-3.5" />
        </button>

        <!-- Icon -->
        <div
          class="grid shrink-0 place-items-center rounded-lg"
          :class="[
            isFolder ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            view === 'list' ? 'size-9' : 'size-10',
          ]"
        >
          <component :is="icon" :class="view === 'list' ? 'size-4.5' : 'size-5'" />
        </div>

        <!-- ── List view ── -->
        <template v-if="view === 'list'">
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium">{{ entry.name }}</span>
            <p v-if="entry.path" class="truncate text-xs text-muted-foreground">{{ subtitle }}</p>
            <p v-else-if="entry.kind === 'doc'" class="truncate text-xs text-muted-foreground">{{ typeLabel }}</p>
            <p v-if="entry.kind === 'doc' && entry.status === 'failed' && entry.failedError"
              class="flex items-start gap-1 text-xs text-destructive">
              <TriangleAlert class="mt-0.5 size-3 shrink-0" />
              <span class="line-clamp-1">{{ entry.failedError }}</span>
            </p>
          </div>
          <div class="hidden w-32 shrink-0 sm:block">
            <SharedVaultStatusBadge v-if="entry.kind === 'doc'" :status="entry.status!" :facts-count="entry.factsCount" />
            <span v-else-if="!entry.path" class="text-xs text-muted-foreground">{{ subtitle }}</span>
          </div>
          <span class="hidden w-28 shrink-0 text-right text-xs text-muted-foreground md:block">{{ modified }}</span>
        </template>

        <!-- ── Grid view ── -->
        <template v-else>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-medium">{{ entry.name }}</span>
            <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <SharedVaultStatusBadge v-if="entry.kind === 'doc'" :status="entry.status!" :facts-count="entry.factsCount" />
              <span v-else-if="!entry.path">{{ subtitle }}</span>
              <span v-if="entry.path" class="truncate">{{ subtitle }}</span>
            </div>
            <span v-if="entry.kind === 'doc' && !entry.path" class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ typeLabel }}
            </span>
          </div>
        </template>

        <!-- ⋮ menu (touch / discoverable) -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child @click.stop>
            <Button size="icon-sm" variant="ghost"
              class="shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              :class="view === 'grid' ? 'absolute right-2 top-2' : ''">
              <MoreVertical class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" @click.stop>
            <!-- Trash view: restore / delete permanently -->
            <template v-if="trashView">
              <DropdownMenuItem @select="emit('restore', entry)">
                <RotateCcw class="mr-2 size-4" /> Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive focus:text-destructive" @select="emit('purge', entry)">
                <Trash2 class="mr-2 size-4" /> Delete permanently
              </DropdownMenuItem>
            </template>
            <!-- Normal view -->
            <template v-else>
              <DropdownMenuItem @select="onPrimary">
                <component :is="isFolder ? FolderOpen : Eye" class="mr-2 size-4" />
                {{ isFolder ? 'Open' : 'Preview' }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="!isFolder" @select="emit('download', entry)">
                <Download class="mr-2 size-4" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem @select="emit('toggleSelect', entry)">
                <CheckSquare class="mr-2 size-4" /> Select
              </DropdownMenuItem>
              <template v-if="!readonly">
                <DropdownMenuItem v-if="isFolder" @select="emit('rename', entry)">
                  <Pencil class="mr-2 size-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem @select="emit('move', entry)">
                  <FolderInput class="mr-2 size-4" /> Move to…
                </DropdownMenuItem>
                <DropdownMenuItem v-if="!isFolder" @select="emit('toggleIngest', entry)">
                  <component :is="entry.ingest ? EyeOff : Sparkles" class="mr-2 size-4" />
                  {{ entry.ingest ? 'Stop AI reading' : 'Read with AI' }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive focus:text-destructive" @select="emit('remove', entry)">
                  <Trash2 class="mr-2 size-4" /> Move to Trash
                </DropdownMenuItem>
              </template>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ContextMenuTrigger>

    <!-- Right-click menu (same actions) -->
    <ContextMenuContent>
      <template v-if="trashView">
        <ContextMenuItem @select="emit('restore', entry)">
          <RotateCcw class="mr-2 size-4" /> Restore
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem class="text-destructive focus:text-destructive" @select="emit('purge', entry)">
          <Trash2 class="mr-2 size-4" /> Delete permanently
        </ContextMenuItem>
      </template>
      <template v-else>
        <ContextMenuItem @select="onPrimary">
          <component :is="isFolder ? FolderOpen : Eye" class="mr-2 size-4" />
          {{ isFolder ? 'Open' : 'Preview' }}
        </ContextMenuItem>
        <ContextMenuItem v-if="!isFolder" @select="emit('download', entry)">
          <Download class="mr-2 size-4" /> Download
        </ContextMenuItem>
        <ContextMenuItem @select="emit('toggleSelect', entry)">
          <CheckSquare class="mr-2 size-4" /> Select
        </ContextMenuItem>
        <template v-if="!readonly">
          <ContextMenuItem v-if="isFolder" @select="emit('rename', entry)">
            <Pencil class="mr-2 size-4" /> Rename
          </ContextMenuItem>
          <ContextMenuItem @select="emit('move', entry)">
            <FolderInput class="mr-2 size-4" /> Move to…
          </ContextMenuItem>
          <ContextMenuItem v-if="!isFolder" @select="emit('toggleIngest', entry)">
            <component :is="entry.ingest ? EyeOff : Sparkles" class="mr-2 size-4" />
            {{ entry.ingest ? 'Stop AI reading' : 'Read with AI' }}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem class="text-destructive focus:text-destructive" @select="emit('remove', entry)">
            <Trash2 class="mr-2 size-4" /> Move to Trash
          </ContextMenuItem>
        </template>
      </template>
    </ContextMenuContent>
  </ContextMenu>
</template>
