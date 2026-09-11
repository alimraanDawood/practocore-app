<script lang="ts" setup>
// Page-aware section of the global sidebar, rendered between the workspace nav
// and the footer. It shows recent conversations on assistant/research pages and
// stays hidden on matter and engagement pages, whose local navigation lives in
// the page itself. Hidden when the sidebar is collapsed to icons.
//
// The vault used to duplicate its library list here. It no longer does: the
// vault owns a rail of its own on desktop and a home screen listing the same
// libraries on a phone, and two sidebars offering the same links — one of which
// could not show the folder you were in — was one too many.
import {
  MessageSquareText, Plus, ChevronDown, Telescope, FileType2, Files,
} from 'lucide-vue-next';

import { useSidebar } from '~/components/ui/sidebar';

const route = useRoute();

// The assistant lives at /main (pages/main/index.vue). Match it exactly — a
// startsWith('/main') would wrongly fire on every /main/* page (vault, matters…).
const onAssistant = computed(() => route.path === '/main' || route.path === '/main/');
const onResearch = computed(() => route.path === '/main/research' || route.path === '/main/research/');
// On desktop the assistant's chat list moved into the Chat History flyout
// (LayoutChatHistoryPanel), so showing it inline here too would duplicate it.
// The mobile sidebar keeps the inline list.
const isDesktop = useMediaQuery('(min-width: 1024px)');
const showChats = computed(() => onAssistant.value && !isDesktop.value);

const visible = computed(() => showChats.value || onResearch.value || showDocs.value);

// ── Chat: recent conversations ──────────────────────────────────────────────
const { conversations, loading: chatLoading, refresh: refreshChats } = useAssistantHistory();
const activeConvId = computed(() => (typeof route.query.c === 'string' ? route.query.c : ''));
const chatsExpanded = ref(false);
const RECENT_LIMIT = 6;
const visibleChats = computed(() =>
  chatsExpanded.value ? conversations.value : conversations.value.slice(0, RECENT_LIMIT));
const hasMoreChats = computed(() => conversations.value.length > RECENT_LIMIT);

// ── Research: recent conversations ──────────────────────────────────────────
const { conversations: researchConvs, loading: researchLoading, refresh: refreshResearch } = useResearchHistory();
const researchExpanded = ref(false);
const visibleResearch = computed(() =>
  researchExpanded.value ? researchConvs.value : researchConvs.value.slice(0, RECENT_LIMIT));
const hasMoreResearch = computed(() => researchConvs.value.length > RECENT_LIMIT);

// ── Documents drafted in the open chat ──────────────────────────────────────
// Published by <ChatSurface> (it owns the conversation and the preview sheet);
// this only lists them and asks the surface to open one. Shown on both shared
// surfaces, desktop and mobile, so a drafted .docx stays one click away after its
// in-thread card has scrolled off.
const { setOpenMobile } = useSidebar();
const chatDocuments = useChatDocuments();
const docs = chatDocuments.documents;
const docsExpanded = ref(false);
const visibleDocs = computed(() => docsExpanded.value ? docs.value : docs.value.slice(0, RECENT_LIMIT));
const hasMoreDocs = computed(() => docs.value.length > RECENT_LIMIT);
const showDocs = computed(() => (onAssistant.value || onResearch.value) && docs.value.length > 0);

// The preview opens as a sheet over the page, which the mobile sidebar would sit
// on top of — so get out of the way on the way through.
function openDoc(id: string) {
  setOpenMobile(false);
  chatDocuments.requestOpen(id);
}

function openDocsPanel() {
  setOpenMobile(false);
  chatDocuments.requestPanel();
}


// Lazily load each section's data the first time its page is opened.
watch(visible, (on) => {
  if (!on) return;
  if (onAssistant.value) refreshChats();
  if (onResearch.value) refreshResearch();
}, { immediate: true });
</script>

<template>
  <SidebarGroup v-if="showChats || onResearch" class="group-data-[collapsible=icon]:hidden">
    <!-- ── Assistant: recent chats ──────────────────────────────────────── -->
    <template v-if="showChats">
      <SidebarGroupLabel>Recent chats</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton as-child :is-active="!activeConvId">
              <NuxtLink :to="{ path: '/main', query: {} }">
                <Plus />
                <span>New chat</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem v-if="chatLoading && !conversations.length">
            <span class="block px-2 py-1.5 text-xs text-muted-foreground">Loading…</span>
          </SidebarMenuItem>
          <SidebarMenuItem v-else-if="!conversations.length">
            <span class="block px-2 py-1.5 text-xs text-muted-foreground">No conversations yet.</span>
          </SidebarMenuItem>

          <SidebarMenuItem v-for="conv in visibleChats" :key="conv.id">
            <SidebarMenuButton as-child :is-active="activeConvId === conv.id" :tooltip="conv.title">
              <NuxtLink :to="{ path: '/main', query: { c: conv.id } }">
                <MessageSquareText />
                <span class="truncate">{{ conv.title }}</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem v-if="hasMoreChats">
            <SidebarMenuButton class="text-muted-foreground" @click="chatsExpanded = !chatsExpanded">
              <ChevronDown :class="['transition-transform', chatsExpanded ? 'rotate-180' : '']" />
              <span>{{ chatsExpanded ? 'Show less' : 'Recent conversations' }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </template>

    <!-- ── Research: recent conversations ─────────────────────────────── -->
    <template v-else-if="onResearch">
      <SidebarGroupLabel>Recent research</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton as-child :is-active="!activeConvId">
              <NuxtLink :to="{ path: '/main/research', query: {} }">
                <Plus />
                <span>New research</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem v-if="researchLoading && !researchConvs.length">
            <span class="block px-2 py-1.5 text-xs text-muted-foreground">Loading…</span>
          </SidebarMenuItem>
          <SidebarMenuItem v-else-if="!researchConvs.length">
            <span class="block px-2 py-1.5 text-xs text-muted-foreground">No research yet.</span>
          </SidebarMenuItem>

          <SidebarMenuItem v-for="conv in visibleResearch" :key="conv.id">
            <SidebarMenuButton as-child :is-active="activeConvId === conv.id" :tooltip="conv.title">
              <NuxtLink :to="{ path: '/main/research', query: { c: conv.id } }">
                <Telescope />
                <span class="truncate">{{ conv.title }}</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem v-if="hasMoreResearch">
            <SidebarMenuButton class="text-muted-foreground" @click="researchExpanded = !researchExpanded">
              <ChevronDown :class="['transition-transform', researchExpanded ? 'rotate-180' : '']" />
              <span>{{ researchExpanded ? 'Show less' : 'Recent research' }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </template>
  </SidebarGroup>

  <!-- ── Documents drafted in the open chat ───────────────────────────────── -->
  <SidebarGroup v-if="showDocs" class="group-data-[collapsible=icon]:hidden">
    <SidebarGroupLabel>Documents</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="doc in visibleDocs" :key="doc.id">
          <SidebarMenuButton :tooltip="doc.title || doc.filename || 'Document'" @click="openDoc(doc.id)">
            <FileType2 />
            <span class="truncate">{{ doc.title || doc.filename || 'Document' }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem v-if="hasMoreDocs">
          <SidebarMenuButton class="text-muted-foreground" @click="docsExpanded = !docsExpanded">
            <ChevronDown :class="['transition-transform', docsExpanded ? 'rotate-180' : '']" />
            <span>{{ docsExpanded ? 'Show less' : `All ${docs.length} documents` }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Download, rename and delete live in the surface's own panel. -->
        <SidebarMenuItem>
          <SidebarMenuButton class="text-muted-foreground" @click="openDocsPanel">
            <Files />
            <span>Manage documents</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
