import { computed, ref } from 'vue'

/**
 * Central registry of currently-open dismissible overlays (dialogs, sheets,
 * drawers, popovers, dropdown menus and any custom panels).
 *
 * The Android hardware back button (see `useBackButton`) closes the most
 * recently opened overlay before falling back to route navigation. Tracking
 * open state explicitly — instead of scraping the DOM and synthesising
 * `Escape` key events — means every overlay is closed through its own library's
 * normal close path, so exit animations and body-lock cleanup run correctly.
 *
 * Overlays register themselves via the `OverlayBackTracker` renderless
 * component embedded in each shadcn root wrapper, so participation is automatic.
 * Custom (non-component) overlays can register manually with `register` /
 * `unregister`.
 */

export interface OverlayEntry {
  id: number
  /** Closes this overlay through its own state/close path. */
  dismiss: () => void
}

// Module-level state so the stack is shared across the whole app and survives
// component remounts.
const stack = ref<OverlayEntry[]>([])
let nextId = 1

export function useOverlayStack() {
  const register = (dismiss: () => void): number => {
    const id = nextId++
    stack.value.push({ id, dismiss })
    return id
  }

  const unregister = (id: number) => {
    const idx = stack.value.findIndex(e => e.id === id)
    if (idx !== -1) stack.value.splice(idx, 1)
  }

  /**
   * Dismiss the most recently opened overlay.
   * @returns `true` if an overlay was open and dismissed, otherwise `false`.
   */
  const closeTop = (): boolean => {
    const top = stack.value[stack.value.length - 1]
    if (!top) return false
    top.dismiss()
    return true
  }

  return {
    /** Reactive list of open overlays, oldest → newest. */
    stack,
    /** Number of overlays currently open. */
    count: computed(() => stack.value.length),
    hasOpenOverlay: computed(() => stack.value.length > 0),
    register,
    unregister,
    closeTop,
  }
}
