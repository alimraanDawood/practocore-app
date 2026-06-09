// useAiUsage — shared, reactive AI-credit usage state.
//
// One source of truth (a Nuxt useState ref) so any number of widgets — the
// header gauge, the Billing card, etc. — show the same live figure. The chat
// calls refresh() after each AI round, so the gauge ticks up as credits burn
// without every consumer polling on its own.
//
// Usage:
//   const { usage, refresh } = useAiUsage();
//   onMounted(refresh);            // hydrate
//   await refresh();               // after something spends credits

import { getAiUsage, type AiUsage } from '~/services/ai';

export function useAiUsage() {
  const usage = useState<AiUsage | null>('ai.usage', () => null);
  const loading = useState<boolean>('ai.usage.loading', () => false);

  async function refresh() {
    // Guard against overlapping fetches (e.g. open + send firing together).
    if (loading.value) return;
    loading.value = true;
    try {
      usage.value = await getAiUsage();
    } catch {
      // Keep the last good value on failure — a stale gauge beats a blank one.
    } finally {
      loading.value = false;
    }
  }

  return { usage, loading, refresh };
}
