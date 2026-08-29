<script lang="ts" setup>
import { MoreHorizontal, X } from 'lucide-vue-next';
import type { VaultAction } from './MenuItems.vue';

// The action bar for a live selection, in the phone file-manager idiom: a
// full-width bar across the bottom, each action an icon over its own label,
// spaced evenly so every one is the same size target.
//
// It carries no count — the shell's header swaps to a selection header while this
// is up (see useVaultSelectionUi), and a bar that also said "3 selected" would be
// saying it twice.
//
// It does carry a clear button, but only in the floating layout: on a phone the
// header's X is a thumb-reach away at the top of the same screen, while on a
// desktop the header is across the window from a pill anchored to the bottom
// centre, so making the user travel there to undo a selection is a poor joke.
//
// Past `sm` the same actions collapse to a floating pill with inline labels: a
// full-width bar is a thumb-reach affordance, and on a desktop it would be a
// hundred-pixel-tall strip of mostly nothing.
const props = defineProps<{
  /** The actions that get their own button. */
  actions: VaultAction[];
  /** Actions that always live under "More" — the ones too specific, too rare or
   *  too destructive to spend a slot on. This is where a single item's own menu
   *  went once rows stopped carrying an ellipsis of their own. */
  more?: VaultAction[];
  /** Beyond this many buttons the tail folds into "More" too — a phone fits five. */
  max?: number;
}>();

const MAX = computed(() => props.max ?? 5);

// The same selection the shell header is showing; clearing here and clearing
// there are the same act, so they share the one published `clear`.
const selection = useVaultSelectionUi();
const hasMore = computed(() => !!props.more?.length);
// "More" occupies a slot itself whenever it is shown, so the primaries have one
// less to share.
const room = computed(() => (hasMore.value || props.actions.length > MAX.value
  ? MAX.value - 1
  : MAX.value));
const primary = computed(() => props.actions.slice(0, room.value));
const overflow = computed(() => [...props.actions.slice(room.value), ...(props.more ?? [])]);
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-full opacity-0 sm:translate-y-2"
    leave-active-class="transition duration-150 ease-in" leave-to-class="translate-y-full opacity-0 sm:translate-y-2">
    <div
      v-if="actions.length"
      class="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background/95 pb-(--safe-area-bottom) backdrop-blur
             sm:absolute sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:items-center
             sm:gap-1 sm:rounded-xl sm:border sm:p-1 sm:pb-1 sm:shadow-lg">
      <!-- Floating layout only — see the note above. -->
      <button
        v-if="selection"
        type="button"
        class="hidden shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium
               text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
        title="Clear selection"
        @click="selection.clear()">
        <X class="size-4 shrink-0" />
        Cancel
      </button>
      <span v-if="selection" class="mx-0.5 hidden h-5 w-px shrink-0 bg-border sm:block" />

      <button
        v-for="a in primary"
        :key="a.id"
        type="button"
        class="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors
               hover:bg-accent active:bg-accent sm:flex-none sm:flex-row sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-sm"
        :class="a.danger ? 'text-destructive' : 'text-foreground'"
        :title="a.label"
        @click="a.run()">
        <component :is="a.icon" class="size-5 shrink-0 sm:size-4" />
        <span class="max-w-full truncate">{{ a.label }}</span>
      </button>

      <DropdownMenu v-if="overflow.length">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors
                   hover:bg-accent active:bg-accent sm:flex-none sm:flex-row sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-sm"
            title="More">
            <MoreHorizontal class="size-5 shrink-0 sm:size-4" />
            <span>More</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" class="w-52">
          <SharedVaultMenuItems :actions="overflow" variant="dropdown" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Transition>
</template>
