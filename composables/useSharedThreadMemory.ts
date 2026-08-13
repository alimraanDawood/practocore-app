/**
 * Remembers which shared chat thread was last open, per shared mode
 * ('assistant' = /main, 'research' = /main/research).
 *
 * <ChatSurface> unmounts when you navigate away, and the open thread lives only in
 * the `?c=` query — so leaving the Assistant and coming back through the sidebar link
 * (which points at a bare `/main`) used to drop you into an empty chat. This gives the
 * surface something to restore from: on mount with no `?c`, it puts the remembered id
 * back in the URL and the normal route watcher loads it.
 *
 * Deliberately module scope rather than localStorage: it lives as long as the tab, so
 * a reload or a different signed-in user never inherits someone else's thread. Opening
 * another conversation overwrites it; "New chat" clears it.
 */
const lastThread = new Map<string, string>();

export function useSharedThreadMemory() {
  return {
    /** Record the open thread for `key`. An empty id forgets it (i.e. a new chat). */
    remember(key: string, id: string) {
      if (id) lastThread.set(key, id);
      else lastThread.delete(key);
    },
    /** The thread to resume for `key`, or '' when there is nothing to resume. */
    recall(key: string): string {
      return lastThread.get(key) ?? '';
    },
    forget(key: string) {
      lastThread.delete(key);
    },
  };
}
