/**
 * The documents drafted in the OPEN shared chat, published so the global sidebar
 * can list them.
 *
 * <ChatSurface> owns the list (it holds the conversation, the realtime
 * subscription and the preview sheet), but the sidebar sits outside it in the
 * layout and has no way to reach in. So the surface publishes what it has here and
 * listens for open requests coming back the other way; the sidebar only reads and
 * asks. Nothing is fetched in this file — it is a channel, not a store.
 *
 * Module scope rather than a Nuxt state so it lives exactly as long as the tab and
 * is never serialized into the payload (the rows carry file tokens). Only the
 * shared surfaces (/main and /main/research) publish, which are also the only pages
 * the sidebar section renders on.
 */
import type { GeneratedDocument } from '~/services/documents';

const documents = ref<GeneratedDocument[]>([]);
const loading = ref(false);
/** Bumped by the sidebar with the id of the document to open. */
const openSignal = ref<{ id: string; nonce: number } | null>(null);
/** Bumped by the sidebar to open the surface's full Documents panel. */
const panelSignal = ref(0);
let nonce = 0;

export function useChatDocuments() {
  return {
    documents: readonly(documents) as Readonly<Ref<GeneratedDocument[]>>,
    loading: readonly(loading) as Readonly<Ref<boolean>>,
    openSignal: readonly(openSignal) as Readonly<Ref<{ id: string; nonce: number } | null>>,
    panelSignal: readonly(panelSignal) as Readonly<Ref<number>>,

    /** ChatSurface → sidebar. Called on every change of the open conversation. */
    publish(docs: GeneratedDocument[], isLoading = false) {
      documents.value = docs;
      loading.value = isLoading;
    },
    /** ChatSurface on unmount — nothing is open, so the sidebar shows nothing. */
    clear() {
      documents.value = [];
      loading.value = false;
      openSignal.value = null;
    },
    /** Sidebar → ChatSurface: open this document in the surface's preview sheet. */
    requestOpen(id: string) {
      if (id) openSignal.value = { id, nonce: ++nonce };
    },
    /** Sidebar → ChatSurface: open the full Documents panel (download, rename, delete). */
    requestPanel() {
      panelSignal.value++;
    },
  };
}
