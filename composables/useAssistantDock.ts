import type { Component } from 'vue';
import type { ContextItem } from '~/services/ai';

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

  function open() { if (context.value) isOpen.value = true; }
  function close() { isOpen.value = false; }
  function toggle() { isOpen.value = !isOpen.value; }

  return { isOpen, context, owner, open, close, toggle };
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
