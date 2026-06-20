<script lang="ts" setup>
// Page-aware section of the global sidebar, rendered between the workspace nav
// and the footer. On the assistant it shows recent conversations; on the vault
// it shows the firm + case-file libraries as quick-clicks. Selection is
// URL-driven (`?c=` for chat, `?lib=` for vault) so clicking here drives the
// page without the sidebar reaching into page state. Hidden when the sidebar is
// collapsed to icons (the rail stays clean).
import { MessageSquareText, Plus, Building2, Briefcase, ChevronDown } from 'lucide-vue-next';

const route = useRoute();

// The assistant lives at /main (pages/main/index.vue). Match it exactly — a
// startsWith('/main') would wrongly fire on every /main/* page (vault, matters…).
const onAssistant = computed(() => route.path === '/main' || route.path === '/main/');
const onVault = computed(() => route.path.startsWith('/main/vault'));
const visible = computed(() => onAssistant.value || onVault.value);

// ── Chat: recent conversations ──────────────────────────────────────────────
const { conversations, loading: chatLoading, refresh: refreshChats } = useAssistantHistory();
const activeConvId = computed(() => (typeof route.query.c === 'string' ? route.query.c : ''));
const chatsExpanded = ref(false);
const RECENT_LIMIT = 6;
const visibleChats = computed(() =>
  chatsExpanded.value ? conversations.value : conversations.value.slice(0, RECENT_LIMIT));
const hasMoreChats = computed(() => conversations.value.length > RECENT_LIMIT);

// ── Vault: libraries ────────────────────────────────────────────────────────
const { matters, loading: vaultLoading, orgId, refresh: refreshVault, libraryQuery } = useVaultLibraries();
const activeLib = computed(() => (typeof route.query.lib === 'string' ? route.query.lib : ''));
const vaultExpanded = ref(false);
const visibleMatters = computed(() =>
  vaultExpanded.value ? matters.value : matters.value.slice(0, RECENT_LIMIT));
const hasMoreMatters = computed(() => matters.value.length > RECENT_LIMIT);

// Lazily load each section's data the first time its page is opened.
watch(visible, (on) => {
  if (!on) return;
  if (onAssistant.value) refreshChats();
  if (onVault.value) refreshVault();
}, { immediate: true });
</script>

<template>
  <SidebarGroup v-if="visible" class="group-data-[collapsible=icon]:hidden">
    <!-- ── Assistant: recent chats ──────────────────────────────────────── -->
    <template v-if="onAssistant">
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

    <!-- ── Vault: libraries ─────────────────────────────────────────────── -->
    <template v-else-if="onVault">
      <SidebarGroupLabel>Libraries</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem v-if="orgId">
            <SidebarMenuButton
              as-child
              :is-active="activeLib === `org:${orgId}`"
              tooltip="Firm Library">
              <NuxtLink :to="{ path: '/main/vault', query: libraryQuery({ scope: 'org', scopeId: orgId, label: 'Firm Library' }) }">
                <Building2 />
                <span>Firm Library</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem v-if="vaultLoading && !matters.length">
            <span class="block px-2 py-1.5 text-xs text-muted-foreground">Loading…</span>
          </SidebarMenuItem>
          <SidebarMenuItem v-else-if="!matters.length && !orgId">
            <span class="block px-2 py-1.5 text-xs text-muted-foreground">No case files yet.</span>
          </SidebarMenuItem>

          <SidebarMenuItem v-for="m in visibleMatters" :key="m.id">
            <SidebarMenuButton
              as-child
              :is-active="activeLib === `matter:${m.id}`"
              :tooltip="m.name || 'Matter'">
              <NuxtLink :to="{ path: '/main/vault', query: libraryQuery({ scope: 'matter', scopeId: m.id, label: m.name || 'Matter' }) }">
                <Briefcase />
                <span class="truncate">{{ m.name || 'Matter' }}</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem v-if="hasMoreMatters">
            <SidebarMenuButton class="text-muted-foreground" @click="vaultExpanded = !vaultExpanded">
              <ChevronDown :class="['transition-transform', vaultExpanded ? 'rotate-180' : '']" />
              <span>{{ vaultExpanded ? 'Show less' : `All case files (${matters.length})` }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </template>
  </SidebarGroup>
</template>
