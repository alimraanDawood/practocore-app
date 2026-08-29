<script lang="ts" setup>
import { MoreVertical, Check } from 'lucide-vue-next';
import type { VaultRow } from '~/composables/useVaultLibrary';
import type { VaultDocument } from '~/services/vault';
import { fileIcon, fileTint, fileWash, whenLabel, typeLabel } from '~/utils/vaultDisplay';
import type { VaultAction } from './MenuItems.vue';

// One entry — folder or document — as a list row or a grid tile.
//
// Purely presentational: every gesture is reported upward and the host decides
// what it means, because the same row appears in a library, a search result and
// the recycle bin, where "open" and "delete" mean different things.
//
// The interaction model is the desktop one for a mouse and the touch one for a
// finger, told apart by `pointerType` rather than a media query — a touchscreen
// laptop is both, and whichever the user just used should win:
//   • mouse — click selects, double-click opens, ⌘/ctrl-click adds, shift-click
//     extends, right-click opens the context menu on the row it hit, and a drag
//     off the row moves it.
//   • finger — a tap opens, a long press starts a selection (Android's Files
//     idiom), a tap then toggles, and dragging from the long press moves it.
//
// Dragging is reported as pointer events rather than done with HTML5 drag-and-
// drop: `dragstart` never fires from a touch, so the native API would have made
// moving a file a desktop-only ability.
const props = withDefaults(defineProps<{
  row: VaultRow;
  view: 'list' | 'grid';
  index: number;
  actions: VaultAction[];
  selected?: boolean;
  /** A selection is in progress — a plain click toggles rather than opens. */
  selecting?: boolean;
  /** This row is being dragged (dimmed) or is a hovered drop target (ringed). */
  dragging?: boolean;
  dropTarget?: boolean;
  /** Keyboard focus ring, driven by the host's arrow-key cursor. */
  cursor?: boolean;
}>(), {
  selected: false, selecting: false, dragging: false, dropTarget: false, cursor: false,
});

const emit = defineEmits<{
  open: [VaultRow];
  select: [VaultRow, { additive: boolean; range: boolean; index: number }];
  longpress: [VaultRow, number];
  /** A press began on this row — the host decides if it becomes a drag. */
  pressstart: [VaultRow, number, PointerEvent];
}>();

const doc = computed(() => props.row.doc as VaultDocument | undefined);
const icon = computed(() => fileIcon(props.row));
const tint = computed(() => fileTint(props.row));
const wash = computed(() => fileWash(props.row));
const meta = computed(() => {
  if (props.row.kind === 'folder') {
    const c = props.row.count ?? 0;
    return `${c} item${c === 1 ? '' : 's'}`;
  }
  return typeLabel(props.row);
});

// A folder is the only valid drop target; documents accept nothing. The id is
// published on the element so the host can hit-test it with elementFromPoint.
const droppable = computed(() => props.row.kind === 'folder');

// ── Pointer handling ────────────────────────────────────────────────────────
// One handler for mouse and touch: `pointerType` tells them apart, so there is
// no media query to keep in step with the actual input device (a touchscreen
// laptop is both, and whichever one the user just touched should win).
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressed: { x: number; y: number; touch: boolean } | null = null;
let longFired = false;

// Set once a finger's long press has fired: the row stops claiming the scroll
// gesture, so the next move drags the row instead of scrolling the list. Only
// this row is pinned — the rest of the list still scrolls normally.
const armed = ref(false);

function cancelPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  pressed = null;
  armed.value = false;
}

function onPointerDown(e: PointerEvent) {
  if (e.button === 2) return; // right-click is the context menu's business
  longFired = false;
  const touch = e.pointerType !== 'mouse';
  pressed = { x: e.clientX, y: e.clientY, touch };
  emit('pressstart', props.row, props.index, e);
  if (!touch) return;
  pressTimer = setTimeout(() => {
    longFired = true;
    pressTimer = null;
    // A short buzz is the only feedback that a selection has begun before the
    // finger lifts; without it a long press feels like a tap that did nothing.
    try { navigator.vibrate?.(12); } catch { /* not everywhere, never required */ }
    armed.value = true;
    emit('longpress', props.row, props.index);
  }, 420);
}

// Scrolling must never turn into a long press: a few pixels of travel cancels.
function onPointerMove(e: PointerEvent) {
  if (!pressed || !pressTimer) return;
  if (Math.abs(e.clientX - pressed.x) > 8 || Math.abs(e.clientY - pressed.y) > 8) cancelPress();
}

function onClick(e: MouseEvent) {
  // The long press already acted; the finger lifting must not also open the row.
  if (longFired) { longFired = false; cancelPress(); return; }
  const touch = pressed?.touch ?? false;
  cancelPress();

  const additive = e.metaKey || e.ctrlKey;
  const range = e.shiftKey;
  if (additive || range) {
    emit('select', props.row, { additive, range, index: props.index });
    return;
  }
  // In a live selection a plain click toggles — on both input kinds, so leaving
  // selection mode is always "deselect the last one" rather than a hidden gesture.
  if (props.selecting) {
    emit('select', props.row, { additive: true, range: false, index: props.index });
    return;
  }
  if (touch) emit('open', props.row);
  else emit('select', props.row, { additive: false, range: false, index: props.index });
}

function onDblClick() {
  if (!props.selecting) emit('open', props.row);
}

// Right-clicking a row that is not in the selection makes it the selection first,
// so the menu that opens always acts on what the user is pointing at.
function onContextMenu() {
  cancelPress();
  if (!props.selected) emit('select', props.row, { additive: false, range: false, index: props.index });
}

</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        :data-idx="index"
        :data-drop-id="droppable ? row.id : undefined"
        :style="armed ? { touchAction: 'none' } : undefined"
        class="group relative select-none outline-none transition-colors"
        :class="[
          view === 'list'
            ? 'flex items-center gap-3 rounded-lg px-2 py-1.5'
            : 'flex flex-col gap-2 rounded-xl border p-3',
          selected ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : 'hover:bg-accent/60',
          dropTarget ? 'ring-2 ring-inset ring-primary' : '',
          dragging ? 'opacity-40' : '',
          cursor && !selected ? 'ring-1 ring-inset ring-ring/50' : '',
        ]"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="cancelPress"
        @pointercancel="cancelPress"
        @click="onClick"
        @dblclick="onDblClick"
        @contextmenu="onContextMenu">

        <!-- ── Icon / thumbnail ─────────────────────────────────────────── -->
        <div
          class="relative shrink-0 grid place-items-center"
          :class="view === 'list' ? 'size-9 rounded-lg' : 'aspect-[4/3] w-full rounded-lg'">
          <div
            class="absolute inset-0 rounded-lg"
            :class="wash" />
          <component
            :is="icon"
            class="relative"
            :class="[tint, view === 'list' ? 'size-5' : 'size-9']" />

          <!-- The selection tick sits on the icon rather than in a column of its
               own, so turning selection on never reflows the list. -->
          <button
            v-if="selecting || selected"
            class="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full border-2 border-background transition-colors"
            :class="selected ? 'bg-primary text-primary-foreground' : 'bg-background text-transparent ring-1 ring-border hover:ring-primary'"
            :aria-label="selected ? 'Deselect' : 'Select'"
            @click.stop="emit('select', row, { additive: true, range: false, index })">
            <Check class="size-2.5" stroke-width="4" />
          </button>
        </div>

        <!-- ── Name + meta ──────────────────────────────────────────────── -->
        <div class="min-w-0 flex-1" :class="view === 'grid' ? 'w-full' : ''">
          <p
            class="truncate text-sm font-medium"
            :class="view === 'grid' ? 'leading-snug' : ''"
            :title="row.name">
            {{ row.name }}
          </p>
          <p v-if="row.path" class="truncate text-xs text-muted-foreground" :title="row.path">
            {{ row.path }}
          </p>
          <p v-else-if="view === 'grid'" class="truncate text-xs text-muted-foreground">
            {{ meta }} · {{ whenLabel(row.modified) }}
          </p>
          <p v-else class="truncate text-xs text-muted-foreground sm:hidden">
            {{ meta }} · {{ whenLabel(row.modified) }}
          </p>
        </div>

        <!-- ── List columns ─────────────────────────────────────────────────
             Kind, then ingestion state, then date. A folder's item count belongs
             beside it at every width — it is the only thing that distinguishes
             two folders with similar names. -->
        <template v-if="view === 'list'">
          <span class="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:block">
            {{ meta }}
          </span>
          <span class="hidden w-32 shrink-0 sm:flex sm:justify-start">
            <SharedVaultStatusBadge
              v-if="doc && doc.status"
              :status="doc.status"
              :facts-count="doc.facts_count" />
          </span>
          <span class="hidden w-28 shrink-0 text-right text-xs text-muted-foreground md:block">
            {{ whenLabel(row.modified) }}
          </span>
        </template>

        <!-- ── Row overflow ─────────────────────────────────────────────── -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              class="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-100 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              :class="view === 'grid' ? 'absolute right-1 top-1 bg-background/80 backdrop-blur' : ''"
              title="More"
              @click.stop
              @pointerdown.stop>
              <MoreVertical class="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52">
            <SharedVaultMenuItems :actions="actions" variant="dropdown" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent class="w-56">
      <SharedVaultMenuItems :actions="actions" variant="context" />
    </ContextMenuContent>
  </ContextMenu>
</template>
