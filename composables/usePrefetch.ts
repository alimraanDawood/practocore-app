import { useMattersStore } from '~/stores/matters';

/**
 * Composable for prefetching data on link hover/focus for smoother navigation
 * Especially useful for mobile apps to reduce perceived loading time
 */
export function usePrefetch() {
  const mattersStore = useMattersStore();

  /**
   * Prefetch matter data when user hovers/focuses on a link
   * This makes navigation feel instant on mobile
   */
  const prefetchMatter = (matterId: string) => {
    if (!matterId) return;

    // Only prefetch if not already cached or cache is stale
    if (mattersStore.isMatterStale(matterId)) {
      // Prefetch in background without showing loading
      mattersStore.fetchMatterInBackground(matterId).catch(err => {
        // Silent fail - prefetch is opportunistic
        console.debug('Prefetch failed:', err);
      });
    }
  };

  /**
   * Create event handlers for prefetching on hover/touchstart
   * Usage: <NuxtLink v-bind="prefetchHandlers(() => prefetchMatter(matter.id))">
   */
  const prefetchHandlers = (prefetchFn: () => void) => {
    return {
      onMouseenter: prefetchFn,
      onFocus: prefetchFn,
      // On mobile, touchstart happens before click
      onTouchstart: prefetchFn,
    };
  };

  return {
    prefetchMatter,
    prefetchHandlers,
  };
}
