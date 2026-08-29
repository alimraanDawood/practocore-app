import type { Component } from 'vue';
import type { ContextItem, AiActionResult } from '~/services/ai';

// The floating assistant dock lets the user talk to PractoAI from anywhere without
// leaving the page they're on: a slide-in panel (pushing the page left on desktop, a
// bottom sheet on touch) that hosts the same shared <ChatSurface> as /main, pre-loaded
// with the CURRENT page's context. State is global (useState) so the panel — mounted
// once in layouts/default.vue — survives navigation, while each context-providing page
// registers what it contributes via provideDockContext().

export interface DockContext {
  // Stable per-page partition key, e.g. "matter:<id>", "vault:<id>", "calendar". Drives
  // per-context threads: the dock lists/resumes only this key's conversations, so
  // returning to a matter picks up where the user left off. Keep it URL-stable.
  key: string;
  // Primary + secondary lines shown in the dock header (e.g. matter name / case number).
  label: string;
  sublabel?: string;
  // Optional lucide icon component for the header + FAB affordance.
  icon?: Component;
  // Structured context pre-selected into the composer (matter/deadline/user), folded
  // into the sent AiContext so the backend receives matterIds/deadlineIds/userIds.
  chips?: ContextItem[];
  // Free-text context header attached to EVERY turn (via ChatSurface.contextProvider) —
  // used for context the structured chips can't carry (vault/engagement/calendar
  // identity, current view, etc.). Keep it short; it rides on the cached-prefix budget.
  contextText?: string;
  // Optional prompt auto-sent when the dock first opens on this context.
  seed?: string;
}

// A monotonic token identifies the page that currently owns the dock context, so a
// page's onScopeDispose only clears the context if it hasn't already been replaced by
// a page navigated to afterwards (SPA route changes can overlap mount/unmount).
let ownerSeq = 0;

export function useAssistantDock() {
  const isOpen = useState<boolean>('assistant-dock-open', () => false);
  const context = useState<DockContext | null>('assistant-dock-context', () => null);
  const owner = useState<number>('assistant-dock-owner', () => 0);
  // Monotonic tick bumped whenever the dock assistant approves/fulfils a write
  // proposal (e.g. schedules a reminder, adjourns a deadline). The active page
  // watches it to refresh its own server-synced data, since the dock has no direct
  // channel to the page and the realtime subscription can't be relied on to surface
  // a record the backend wrote mid-conversation. Mirrors the AddEventDialog's
  // explicit `@created` refresh for the button path.
  const writeSignal = useState<number>('assistant-dock-write-signal', () => 0);
  // The structured result of that write (tool name + data map), so the page can react
  // specifically — e.g. jump the calendar to a freshly-scheduled reminder's date so
  // the new event is actually in view, not just silently present on some other cell.
  const lastWrite = useState<AiActionResult | null>('assistant-dock-last-write', () => null);
  // Pages that put their own bar across the bottom of the screen raise this while
  // it is up. The launcher is `fixed bottom-6 right-6`, which is exactly where a
  // full-width action bar puts its rightmost button — so without this the dock
  // silently covers a "Move here" or a "Delete" and the tap goes to the assistant.
  // A counter, not a flag: two bars can overlap in time (a selection handing off
  // to a move), and the second one must not un-suppress on the first one's exit.
  const suppressed = useState<number>('assistant-dock-suppressed', () => 0);

  function open() { if (context.value) isOpen.value = true; }
  function close() { isOpen.value = false; }
  function toggle() { isOpen.value = !isOpen.value; }
  function signalWrite(action?: AiActionResult | null) {
    lastWrite.value = action ?? null;
    writeSignal.value++; // bump last so watchers see lastWrite already set
  }

  return {
    isOpen, context, owner, writeSignal, lastWrite, suppressed,
    open, close, toggle, signalWrite,
  };
}

/**
 * Hide the dock launcher for as long as `active` is true and this scope is alive —
 * for a page that needs the bottom-right corner for a bar of its own.
 */
export function useSuppressDockLauncher(active: MaybeRefOrGetter<boolean>) {
  const { suppressed } = useAssistantDock();
  let held = false;
  const set = (v: boolean) => {
    if (v === held) return;
    held = v;
    suppressed.value = Math.max(0, suppressed.value + (v ? 1 : -1));
  };
  watchEffect(() => { set(!!toValue(active)); });
  onScopeDispose(() => { set(false); });
}

/**
 * Register the current page's dock context for as long as this component is mounted.
 * `source` may be a ref/getter so the context tracks reactive page state (e.g. the
 * loaded matter). Auto-clears on unmount unless another page has since taken over.
 */
export function provideDockContext(source: MaybeRefOrGetter<DockContext | null>) {
  const { context, owner, isOpen } = useAssistantDock();
  const id = ++ownerSeq;

  watchEffect(() => {
    const ctx = toValue(source);
    if (ctx) {
      context.value = ctx;
      owner.value = id;
    } else if (owner.value === id) {
      // This page owned the context and is now withholding it (e.g. still loading).
      context.value = null;
      isOpen.value = false;
    }
  });

  onScopeDispose(() => {
    if (owner.value === id) {
      context.value = null;
      owner.value = 0;
      isOpen.value = false;
    }
  });
}
