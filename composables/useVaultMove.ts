import type { Component } from 'vue';

/**
 * A move in flight, phone-style: instead of picking a destination out of a tree
 * in a dialog, the items are *carried* — you keep browsing normally, and a bar
 * along the bottom drops them wherever you have landed.
 *
 * The reason it lives outside any component is that browsing is the interaction:
 * the route changes, breadcrumbs are used, folders are opened, and the carried
 * items have to survive all of it. A module singleton is enough because only one
 * move can be in flight at a time — carrying two piles at once is not a thing a
 * file manager does.
 *
 * The destination is deliberately NOT stored. Whichever explorer is on screen
 * knows where "here" is and does the move itself; this only remembers what is
 * being carried and where it may not go.
 */
export interface PendingMoveItem {
  id: string;
  kind: 'folder' | 'doc';
  name: string;
  icon: Component;
  /** Tailwind text-colour class for the icon, so the bar matches the row. */
  tint: string;
}

export interface PendingMove {
  /** The library the items came from. `moveDocument`/`moveFolder` only rewrite a
   *  parent id, so a move cannot cross into another library — the bar says so
   *  rather than silently failing. */
  scope: string;
  scopeId: string;
  items: PendingMoveItem[];
  /** Where they are now: dropping them back here is a no-op, not a move. */
  from: string;
  /** Folder ids that cannot receive these items — a folder and its descendants. */
  blocked: string[];
}

const pending = ref<PendingMove | null>(null);

export function useVaultMove() {
  return {
    pending,
    start(move: PendingMove) { pending.value = move; },
    cancel() { pending.value = null; },
  };
}
