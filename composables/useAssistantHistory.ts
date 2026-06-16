import { listConversations, type AiConversationSummary } from '~/services/ai';

// Shared conversation history, lifted out of pages/main/assistant.vue so the
// global sidebar (layouts/default.vue) and the assistant page render the same
// list and stay in sync. Selection is URL-driven via `?c=<id>` — see the
// assistant page's route watcher — so this composable only owns the list.
export function useAssistantHistory() {
  const conversations = useState<AiConversationSummary[]>('ai-conversations', () => []);
  const loading = useState<boolean>('ai-conversations-loading', () => false);
  const loaded = useState<boolean>('ai-conversations-loaded', () => false);

  async function refresh(force = false): Promise<void> {
    if (loading.value) return;
    if (loaded.value && !force) return;
    loading.value = true;
    try {
      const page = await listConversations(1, 30);
      conversations.value = page?.items ?? [];
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  return { conversations, loading, loaded, refresh };
}
