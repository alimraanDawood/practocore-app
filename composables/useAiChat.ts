// useAiChat — a tiny imperative API for opening the AI chat dialog from
// anywhere in the app, with optional pre-filled text and pre-attached files.
//
// Usage:
//   const ai = useAiChat();
//   ai.open({ seedText: 'Help me create a matter from this.' });
//   ai.open({ seedAttachments: filesFromDropZone });
//
// Under the hood it writes a request object to a shared useState ref. The
// SharedAIChat component (components/shared/AI/Chat.vue) watches that ref,
// opens itself, and consumes the seed via its existing prefill/addFiles
// methods. A `requestedAt` timestamp guarantees the watcher fires even when
// the same seed is sent twice in a row.
//
// SharedAITrigger is already mounted on the default layout, so this works
// from any authenticated page without further plumbing.

export interface OpenChatOptions {
  /** Optional message body to drop into the textarea. The user can edit or hit
   *  send as-is — we don't auto-send so they always confirm what's going to AI. */
  seedText?: string;
  /** Optional File objects to attach. Each is run through the same size/type
   *  validation as the in-chat paperclip and rejected with a toast if invalid. */
  seedAttachments?: File[];
}

export interface OpenChatRequest extends OpenChatOptions {
  /** Monotonic timestamp; bumping it forces Chat.vue's watcher to re-fire. */
  requestedAt: number;
}

export function useAiChat() {
  const request = useState<OpenChatRequest | null>('ai.openRequest', () => null);

  function open(options: OpenChatOptions = {}) {
    request.value = {
      seedText: options.seedText,
      seedAttachments: options.seedAttachments,
      requestedAt: Date.now(),
    };
  }

  /** Called by Chat.vue after consuming the seed to clear the signal. */
  function consume() {
    request.value = null;
  }

  return { request, open, consume };
}
