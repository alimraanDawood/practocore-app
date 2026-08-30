<script lang="ts" setup>
// Desktop chat-history flyout. On the assistant page the sidebar's "Assistant"
// entry becomes "Chat History" (see layouts/default.vue) and toggles this panel:
// a sidebar-width column pinned to the right edge of the sidebar, spanning the
// full viewport height. It slides out to the left — tucking behind the sidebar,
// which sits on a higher stacking layer — and clicking anywhere outside dismisses
// it. Mobile keeps its own history sheet in the chat toolbar, so this is
// desktop-only and is never mounted while the sidebar is in its mobile state.
import { MessageSquareText, Plus, Search, X, Loader2, Pencil, Trash2, RefreshCw } from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { renameConversation, deleteConversation, type AiConversationSummary } from '~/services/ai';
import { useSidebar } from '~/components/ui/sidebar';
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue';

const open = defineModel<boolean>('open', { default: false });

const route = useRoute();
const router = useRouter();
const { state, isMobile } = useSidebar();

// The panel starts where the sidebar ends, and follows it when it collapses to icons.
const offset = computed(() => (state.value === 'collapsed' ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)'));

const { conversations, loading, refresh } = useAssistantHistory();
const activeConvId = computed(() => (typeof route.query.c === 'string' ? route.query.c : ''));

const query = ref('');
const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return conversations.value;
  return conversations.value.filter(c => (c.title || '').toLowerCase().includes(q));
});

// Newest-first buckets, so a long list stays scannable.
interface Bucket { label: string; items: typeof conversations.value }

const buckets = computed<Bucket[]>(() => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups: Bucket[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const conv of matches.value) {
    const t = new Date(conv.updated || conv.created).getTime();
    if (Number.isNaN(t)) groups[3].items.push(conv);
    else if (t >= startOfToday) groups[0].items.push(conv);
    else if (t >= startOfToday - day) groups[1].items.push(conv);
    else if (t >= startOfToday - 7 * day) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }
  return groups.filter(g => g.items.length);
});

// Reload the list each time the panel is opened — chats created since the last
// open (or in another tab) should be here.
watch(open, (on) => {
  if (!on) return;
  query.value = '';
  refresh(true);
});

// A mobile-width viewport (sidebar turns into an offcanvas sheet) has no room
// beside the sidebar — close rather than float over the page.
watch(isMobile, (mobile) => { if (mobile) open.value = false; });

function select(id: string) {
  open.value = false;
  router.push({ path: '/main', query: { c: id } });
}

const threadMemory = useSharedThreadMemory();

function startNewChat() {
  open.value = false;
  threadMemory.forget('assistant');
  router.push({ path: '/main', query: {} });
}

// ── Right-click menus ───────────────────────────────────────────────────────
// Renaming and deleting a chat exist in the service and had no UI anywhere. This
// panel is where a lawyer actually looks at their chats — a list of eleven rows
// called "Hello, can you hear me?" is exactly the list that needs tidying — so it
// carries the same menu the assistant's own history sheet does.
//
// One menu for the whole list: a row sets the aim in the target phase, the list
// clears it in the capture phase, so empty space gets the panel's own menu.
const coarsePointer = useMediaQuery('(pointer: coarse)');
const defer = (fn: () => void) => setTimeout(fn, 0);
const ctxConv = ref<AiConversationSummary | null>(null);

const renameTarget = ref<AiConversationSummary | null>(null);
const renameValue = ref('');
const renaming = ref(false);
const deleteTarget = ref<AiConversationSummary | null>(null);
const deleting = ref(false);

function askRename(conv: AiConversationSummary) {
  defer(() => { renameTarget.value = conv; renameValue.value = conv.title || ''; });
}

async function submitRename() {
  const title = renameValue.value.trim();
  const conv = renameTarget.value;
  if (!title || !conv || renaming.value) return;
  renaming.value = true;
  try {
    const ok = await renameConversation(conv.id, title);
    if (!ok) throw new Error('The server refused the new name.');
    // Patched in place rather than refetched: `conversations` is shared state, so
    // the assistant's own history sheet sees the new title too, and the buckets
    // don't re-sort under the pointer.
    const row = conversations.value.find(c => c.id === conv.id);
    if (row) row.title = title;
    renameTarget.value = null;
  } catch (e: any) {
    toast.error(e?.message || 'Could not rename that conversation.');
  } finally {
    renaming.value = false;
  }
}

async function confirmDelete() {
  const conv = deleteTarget.value;
  if (!conv || deleting.value) return;
  deleting.value = true;
  try {
    const ok = await deleteConversation(conv.id);
    if (!ok) throw new Error('The server refused the delete.');
    conversations.value = conversations.value.filter(c => c.id !== conv.id);
    deleteTarget.value = null;
    // Deleting the chat that is currently on screen has to leave the page
    // somewhere real, not on a dead `?c`.
    if (activeConvId.value === conv.id) startNewChat();
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete that conversation.');
  } finally {
    deleting.value = false;
  }
}

function convActions(conv: AiConversationSummary): MenuAction[] {
  return [
    {
      id: 'open', label: 'Open', icon: MessageSquareText,
      disabled: activeConvId.value === conv.id,
      run: () => select(conv.id),
    },
    { id: 'rename', label: 'Rename', icon: Pencil, divider: true, run: () => askRename(conv) },
    {
      id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true,
      run: () => defer(() => { deleteTarget.value = conv; }),
    },
  ];
}

const panelActions = computed<MenuAction[]>(() => {
  const out: MenuAction[] = [
    { id: 'new', label: 'New chat', icon: Plus, run: () => defer(startNewChat) },
  ];
  if (query.value.trim()) {
    out.push({ id: 'clear', label: 'Clear search', icon: X, divider: true, run: () => { query.value = ''; } });
  }
  out.push({ id: 'refresh', label: 'Refresh', icon: RefreshCw, divider: true, run: () => { refresh(true); } });
  return out;
});

useEventListener('keydown', (e: KeyboardEvent) => {
  // A dialog opened from a row's menu is its own world: Escape there closes the
  // dialog, and must not also dismiss the panel underneath it.
  if (renameTarget.value || deleteTarget.value) return;
  if (e.key === 'Escape' && open.value) open.value = false;
});
</script>

<template>
  <!-- Not teleported: the panel is sized off `--sidebar-width`, which
       SidebarProvider defines on the app-shell wrapper. -->
  <div class="contents">
    <!-- Click-away catcher. Transparent: the panel is a sidebar extension, not a
         modal, so the page behind it stays legible. -->
    <div
      v-if="open && !isMobile"
      class="fixed inset-0 z-[8] hidden md:block"
      @click="open = false"
    />

    <Transition
      enter-active-class="transition-[transform,opacity] duration-200 ease-out"
      leave-active-class="transition-[transform,opacity] duration-200 ease-in"
      enter-from-class="-translate-x-full opacity-0"
      leave-to-class="-translate-x-full opacity-0"
    >
      <div
        v-if="open && !isMobile"
        class="fixed top-0 z-[9] hidden h-svh w-(--sidebar-width) flex-col border-r bg-sidebar text-sidebar-foreground shadow-lg transition-[left,transform,opacity] duration-200 ease-out md:flex"
        :style="{ left: offset }"
      >
        <div class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <span class="text-sm font-semibold">Chat History</span>
          <Button size="icon-sm" variant="ghost" class="ml-auto text-muted-foreground" title="Close"
                  @click="open = false">
            <X class="size-4" />
          </Button>
        </div>

        <div class="flex flex-col gap-2 border-b p-2">
          <div class="relative">
            <Search class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="query" placeholder="Search chats" class="h-8 pl-7 text-sm" />
          </div>
          <Button size="sm" variant="outline" class="w-full justify-start" @click="startNewChat">
            <Plus class="size-4" />
            New chat
          </Button>
        </div>

        <ContextMenu>
        <ContextMenuTrigger as-child :disabled="coarsePointer">
        <div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-2" @contextmenu.capture="ctxConv = null">
          <div v-if="loading && !conversations.length" class="flex justify-center py-6">
            <Loader2 class="size-4 animate-spin text-muted-foreground" />
          </div>
          <p v-else-if="!matches.length" class="px-2 py-6 text-center text-xs text-muted-foreground">
            {{ query.trim() ? 'No chats match that search.' : 'No conversations yet.' }}
          </p>

          <div v-for="bucket in buckets" :key="bucket.label" class="mb-2">
            <p class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {{ bucket.label }}
            </p>
            <button
              v-for="conv in bucket.items"
              :key="conv.id"
              type="button"
              class="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              :class="activeConvId === conv.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''"
              :title="conv.title"
              @click="select(conv.id)"
              @contextmenu="ctxConv = conv"
            >
              <MessageSquareText class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="truncate">{{ conv.title }}</span>
            </button>
          </div>
        </div>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-48">
          <SharedActionMenuItems
            :actions="ctxConv ? convActions(ctxConv) : panelActions"
            variant="context" />
        </ContextMenuContent>
        </ContextMenu>
      </div>
    </Transition>

    <!-- Rename / delete. Both live outside the panel's Transition so dismissing
         the panel (or its click-away catcher) can't take a dialog with it. -->
    <Dialog :open="!!renameTarget" @update:open="(v: boolean) => { if (!v) renameTarget = null; }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription class="break-words">{{ renameTarget?.title }}</DialogDescription>
        </DialogHeader>
        <Input v-model="renameValue" autofocus @keydown.enter="submitRename" />
        <DialogFooter>
          <Button variant="outline" @click="renameTarget = null">Cancel</Button>
          <Button :disabled="renaming || !renameValue.trim()" class="gap-1.5" @click="submitRename">
            <Loader2 v-if="renaming" class="size-4 animate-spin" />
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="!!deleteTarget" @update:open="(v: boolean) => { if (!v) deleteTarget = null; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{{ deleteTarget?.title }}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the conversation and everything said in it. Documents it
            produced are kept. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
            <Loader2 v-if="deleting" class="size-4 animate-spin mr-1.5" />
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
