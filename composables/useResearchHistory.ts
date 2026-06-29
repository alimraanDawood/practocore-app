import { listConversations, type AiConversationSummary } from '~/services/ai';

export function useResearchHistory() {
  const conversations = useState<AiConversationSummary[]>('research-conversations', () => []);
  const loading = useState<boolean>('research-conversations-loading', () => false);
  const loaded = useState<boolean>('research-conversations-loaded', () => false);

  async function refresh(force = false): Promise<void> {
    if (loading.value) return;
    if (loaded.value && !force) return;
    loading.value = true;
    try {
      const page = await listConversations(1, 30, 'research');
      conversations.value = page?.items ?? [];
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  return { conversations, loading, loaded, refresh };
}
