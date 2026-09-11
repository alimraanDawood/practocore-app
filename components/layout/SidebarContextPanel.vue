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
  MessageSquareText, Plus, ChevronDown, Telescope,
} from 'lucide-vue-next';

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

const visible = computed(() => showChats.value || onResearch.value);

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


// Lazily load each section's data the first time its page is opened.
watch(visible, (on) => {
  if (!on) return;
  if (onAssistant.value) refreshChats();
  if (onResearch.value) refreshResearch();
}, { immediate: true });
</script>

<template>
  <SidebarGroup v-if="visible" class="group-data-[collapsible=icon]:hidden">
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
</template>
