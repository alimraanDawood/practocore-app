<script lang="ts" setup>
import { Check } from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
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
//   • mouse — click OPENS. Selecting is ⌘/ctrl-click (add), shift-click (extend),
//     or the checkbox that fades in on hover; right-click opens the context menu
//     on the row it hit, and a drag off the row moves it. Click-to-select was the
//     desktop file-manager model, but opening is what people come to a row to do,
//     and a click that drifted a few pixels selected the row instead.
//   • finger — a tap opens, a long press starts a selection (Android's Files
//     idiom), a tap then toggles, and dragging from the long press moves it.
//     There is no per-row menu on a finger at all — no long-press menu (see
//     `coarsePointer`) and no ⋯ button. Acting on something means selecting it
//     first, and the selection bar's "More" carries everything a row's own menu
//     used to. That is the phone file-manager model, and it means one list of
//     actions instead of two that can drift apart.
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

// Reka's ContextMenuTrigger arms a long-press-to-open of its own on touch, at a
// delay longer than ours — so a long press would start a selection and then have
// a context menu land on top of it. Worse, dismissing that menu can leave the
// page's `pointer-events: none` body lock behind (see CLAUDE.md on nested
// modals), after which the selection's action bar stops responding to taps at
// all. Disabling the trigger is decided by media query rather than by the live
// pointer type because reka reads `disabled` when the gesture starts, so the
// answer has to be settled before the finger lands.
const coarsePointer = useMediaQuery('(pointer: coarse)');

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
  travelled = false;
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

// Travel means this was not a click. For a finger it cancels the long press (the
// gesture was a scroll); for a mouse it marks the press as a drag, so the click
// that follows it does not also open the row.
const CLICK_SLOP = 6;
let travelled = false;

function onPointerMove(e: PointerEvent) {
  if (!pressed || travelled) return;
  if (Math.abs(e.clientX - pressed.x) <= CLICK_SLOP && Math.abs(e.clientY - pressed.y) <= CLICK_SLOP) return;
  travelled = true;
  if (pressTimer) cancelPress();
}

function onClick(e: MouseEvent) {
  // The long press already acted; the finger lifting must not also open the row.
  if (longFired) { longFired = false; cancelPress(); return; }
  const dragged = travelled;
  cancelPress();
  travelled = false;

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
  // The pointer moved, so that was a drag rather than a click on this row.
  // Doing nothing is right: opening a row the user was dragging is the more
  // surprising of the two mistakes.
  if (dragged) return;
  emit('open', props.row);
}

// Right-clicking a row that is not in the selection makes it the selection first,
// so the menu that opens always acts on what the user is pointing at.
//
// The listing behind this row is a right-click target of its own (the folder's
// own menu, where Paste lives). Stopping propagation is what keeps the two
// apart: reka's trigger for THIS row is on this same element and still runs,
// while the surface's trigger, being an ancestor, never hears the event.
function onContextMenu(e: MouseEvent) {
  cancelPress();
  e.stopPropagation();
  // On a finger, suppress the WebView's own long-press menu too — reka's trigger
  // is disabled there, so nothing else is preventing it.
  if (coarsePointer.value) { e.preventDefault(); return; }
  if (!props.selected) emit('select', props.row, { additive: false, range: false, index: props.index });
}

</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child :disabled="coarsePointer">
      <div
        :data-idx="index"
        :data-drop-id="droppable ? row.id : undefined"
        :style="{ WebkitTouchCallout: 'none', ...(armed ? { touchAction: 'none' } : {}) }"
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
        @contextmenu="onContextMenu">

        <!-- ── Selection tick (list) ────────────────────────────────────────
             In a column of its own, ahead of the file, so it reads as a
             checkbox rather than a badge. It widens from nothing instead of
             appearing, and the negative margin swallows the flex gap while it
             is closed, so the row slides rather than jumps.

             Two things keep that from showing a sliced circle. `overflow-hidden`
             because the button keeps its full 20px inside a column animating
             from zero, so without it the circle is drawn outside its own column
             — and `-ml-3` puts that overspill past the left edge of the
             scroller, which clips (a scroller with overflow-y set clips the x
             axis too). And the ring is INSET, because a normal Tailwind ring is
             painted outside the border box, so it sits a pixel beyond a column
             sized to the button exactly and is the first thing to be shaved.

             The button then fades in on a delay rather than being revealed by
             the widening column: a circle wiped in from the left looks like the
             clipping this replaced. -->
        <div
          v-if="view === 'list'"
          :aria-hidden="!(selecting || selected)"
          class="shrink-0 overflow-hidden transition-all duration-200 ease-out"
          :class="selecting || selected
            ? 'w-5'
            : '-ml-3 w-0 lg:group-hover:ml-0 lg:group-hover:w-5'">
          <button
            class="grid size-5 place-items-center rounded-full outline-none transition-all duration-150
                   ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            :class="[
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-transparent ring-1 ring-inset ring-border hover:ring-primary',
              selecting || selected
                ? 'scale-100 opacity-100'
                : 'scale-75 opacity-0 lg:group-hover:scale-100 lg:group-hover:opacity-100 lg:group-hover:delay-100',
            ]"
            :tabindex="selecting || selected ? 0 : -1"
            :aria-label="selected ? 'Deselect' : 'Select'"
            @click.stop="emit('select', row, { additive: true, range: false, index })"
            @pointerdown.stop>
            <Check class="size-3" stroke-width="3.5" />
          </button>
        </div>

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

          <!-- A tile has no leading column to put the tick in, so it keeps the
               top-left overlay — the same corner the list column occupies. -->
          <Transition
            enter-active-class="transition duration-200 ease-out" enter-from-class="scale-75 opacity-0"
            leave-active-class="transition duration-150 ease-in" leave-to-class="scale-75 opacity-0">
            <button
              v-if="view === 'grid' && (selecting || selected)"
              class="absolute -left-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-background transition-colors"
              :class="selected ? 'bg-primary text-primary-foreground' : 'bg-background text-transparent ring-1 ring-border hover:ring-primary'"
              :aria-label="selected ? 'Deselect' : 'Select'"
              @click.stop="emit('select', row, { additive: true, range: false, index })"
              @pointerdown.stop>
              <Check class="size-3" stroke-width="3.5" />
            </button>
          </Transition>
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

      </div>
    </ContextMenuTrigger>

    <ContextMenuContent class="w-56">
      <SharedVaultMenuItems :actions="actions" variant="context" />
    </ContextMenuContent>
  </ContextMenu>
</template>
