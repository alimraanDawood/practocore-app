<script lang="ts" setup>
// App-shell layout: a collapsible sidebar (modeled on the assistant page's
// shell) that wraps every page rendered into <slot />. Pages opt out with
// `definePageMeta({ layout: 'blank' })` (or another layout).
import {
  ChevronsUpDown, MessageSquareText, FolderLock, LifeBuoy, Settings,
  Scale, Home, Users, Building2, CalendarClock, LogOut, User as UserIcon, Bell,
  type LucideIcon, Plus, Workflow, Scroll, Telescope, Briefcase, ShieldCheck, History,
} from 'lucide-vue-next';
import {getSignedInUser, signOut} from '~/services/auth';
import AICreditGauge from '~/components/shared/AI/AICreditGauge.vue';
import {useAuthStore} from '~/stores/auth';
import {useOrganisationStore} from '~/stores/organisation';

const workspace = 'PractoCore';
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
authStore.init();

useOfflineSync();

// Unread badge on the sidebar's notifications item. The realtime subscription
// that keeps this current is owned by <SharedNotifications> itself.
const { hasUnread, unreadBadge } = useNotificationCenter();

// ── Current organisation (shown under the brand, switchable) ────────────────
const orgStore = useOrganisationStore();
const currentOrgId = computed(() => getSignedInUser()?.organisation || '');
const orgName = computed(() => {
  if (!currentOrgId.value) return 'Personal account';
  return orgStore.organisation?.name || 'Loading…';
});

onMounted(() => {
  if (currentOrgId.value) orgStore.fetchOrganisation(currentOrgId.value);
});

// ── Signed-in user (footer profile) ─────────────────────────────────────────
const user = computed(() => {
  const u = getSignedInUser();
  return {name: u?.name || 'User', email: u?.email || '', avatar: u?.avatar || ''};
});

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function signOutUser() {
  signOut();
  window.location.reload();
}

// "New Chat" is the one entry into /main that must NOT resume the last thread, so it
// forgets it before navigating. Every other way in (the Assistant nav link, a back
// navigation) restores whatever was open. See composables/useSharedThreadMemory.ts.
const threadMemory = useSharedThreadMemory();

function startNewChat() {
  threadMemory.forget('assistant');
  router.push('/main');
}

interface NavLink {
  label: string;
  icon: LucideIcon;
  to: string;
  exact?: boolean;
  adminOnly?: boolean;
  needsOrg?: boolean;
}

const hasOrg = computed(() => !!getSignedInUser()?.organisation);

const appNav: NavLink[] = [
  // { label: 'Home', icon: Home, to: '/main', exact: true },
  {label: 'Assistant', icon: MessageSquareText, to: '/main', exact: true},
  {label: 'Litigation', icon: Scale, to: '/main/matters'},
  {label: 'Engagements', icon: Briefcase, to: '/main/engagements'},
  {label: 'Compliance', icon: ShieldCheck, to: '/main/compliance'},
  {label: 'Calendar', icon: CalendarClock, to: '/main/calendar'},
  {label: 'Vault', icon: FolderLock, to: '/main/vault'},
  {label: 'Skills', icon: Scroll, to: '/main/skills'},
  // Workflows hidden from the UI for now — too clunky to ship. The routes and the
  // backend remain intact; the entitlement is OFF by default (backend ai/entitlements.go),
  // so /main/workflows renders its "not enabled yet" state even if reached directly.
  // {label: 'Workflows', icon: Workflow, to: '/main/workflows', beta: true},
  {label: 'Research', icon: Telescope, to: '/main/research'},
  {label: 'Lawyers', icon: Users, to: '/main/lawyers', adminOnly: true, needsOrg: true},
  // { label: 'Organisation', icon: Building2, to: '/main/organisation', adminOnly: true, needsOrg: true },
];

const visibleNav = computed(() => appNav.filter((item) => {
  if (item.needsOrg && !hasOrg.value) return false;
  if (item.adminOnly && !authStore.isAdmin) return false;
  return true;
}));

function isActive(item: NavLink): boolean {
  if (item.exact) return route.path === item.to;
  return route.path === item.to || route.path.startsWith(`${item.to}/`);
}

// ── Chat history flyout ─────────────────────────────────────────────────────
// On desktop, while the assistant page is open, its nav entry has nothing left
// to navigate to — so it becomes "Chat History" and toggles a flyout pinned to
// the right edge of the sidebar (see LayoutChatHistoryPanel). Mobile keeps the
// Assistant link and its own history sheet in the chat toolbar — the 1024px
// breakpoint is exactly where that toolbar hides (ChatSurface's `lg:hidden`),
// so one of the two is always available and never both.
const isDesktop = useMediaQuery('(min-width: 1024px)');
const onAssistant = computed(() => route.path === '/main' || route.path === '/main/');
const historyOpen = ref(false);

function isHistoryEntry(item: NavLink): boolean {
  return item.to === '/main' && onAssistant.value && isDesktop.value;
}

// Leaving the assistant turns the entry back into a link; the flyout must not
// outlive it.
watch(onAssistant, (on) => { if (!on) historyOpen.value = false; });
</script>

<template>
  <div class="flex h-svh flex-col safe-area-shell">

    <SidebarProvider class="min-h-0 flex-1 overflow-hidden">
      <!-- Mobile/touch gestures: left-edge swipe opens the offcanvas sidebar,
           swipe-back closes it, and navigation auto-closes it. -->
      <LayoutSidebarMobileGestures />
      <!-- ── Sidebar ─────────────────────────────────────────────────── -->
      <LayoutSidebarCloseMobileOnClick v-slot="{ close }">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>

            <SidebarMenuItem class="flex flex-row items-center gap-1">
              <!-- Brand + current organisation — click to switch organisation. -->
              <SharedSwitchOrganisations>
                <SidebarMenuButton size="lg" class="min-w-0 flex-1 data-[state=open]:bg-sidebar-accent"
                                   :tooltip="orgName">
                  <div
                      class="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-sm font-bold text-background">
                    <img src="@/assets/img/logos/Practo Core Square -- orange.png" class="size-8" alt="PractoCore"/>
                  </div>
                  <div class="grid min-w-0 flex-1 text-left leading-tight">
                    <span class="truncate text-sm font-semibold">{{ workspace }}</span>
                    <span class="truncate text-xs text-muted-foreground">{{ orgName }}</span>
                  </div>
                  <ChevronsUpDown class="ml-auto size-4 shrink-0 text-muted-foreground"/>
                </SidebarMenuButton>
              </SharedSwitchOrganisations>
              <!-- Collapse toggle — hidden in icon mode (the rail handles expanding). -->
              <SidebarTrigger class="size-7 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"/>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton class="border" tooltip="New chat" @click="close(); startNewChat()">
                  <Plus/>
                  <span>New Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <!-- Unified entry into the two matter systems (litigation vs engagement). -->
              <SharedNewWork />
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem v-for="item in visibleNav" :key="item.to">
                  <!-- On the assistant page (desktop) this slot becomes the chat-history
                       toggle instead of a link to the page you're already on. The two
                       cross-fade in place — the outgoing one is taken out of flow so the
                       row never jumps. -->
                  <Transition
                    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
                    leave-active-class="absolute inset-x-0 top-0 transition-[opacity,transform] duration-200 ease-in"
                    enter-from-class="opacity-0 translate-y-1"
                    leave-to-class="opacity-0 -translate-y-1"
                  >
                  <!-- The plain <div> wrappers give <Transition> a single root element to
                       animate: a tooltip-bearing SidebarMenuButton renders a fragment
                       (trigger + portalled content), which it cannot target. -->
                    <div v-if="isHistoryEntry(item)" key="chat-history">
                      <SidebarMenuButton
                        tooltip="Chat History"
                        :is-active="historyOpen"
                        @click="historyOpen = !historyOpen"
                      >
                        <History/>
                        <span>Chat History</span>
                      </SidebarMenuButton>
                    </div>
                    <div v-else key="nav-link">
                      <SidebarMenuButton as-child :tooltip="item.label" :is-active="isActive(item)">
                        <NuxtLink :to="item.to" @click="close">
                          <component :is="item.icon"/>
                          <span>{{ item.label }}</span>
                        </NuxtLink>
                      </SidebarMenuButton>
                    </div>
                  </Transition>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <!-- Page-aware quick-access: recent chats on the assistant, document
               libraries on the vault. -->
          <LayoutSidebarContextPanel />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <!-- AI credit usage — collapses away in icon mode. -->
            <SidebarMenuItem class="group-data-[collapsible=icon]:hidden">
              <div class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
                <span class="text-sm text-muted-foreground">AI credits</span>
                <!-- Opens beside the sidebar (with a gap) rather than flipping up
                     over the footer. The pill sits ~16px inside the sidebar's edge,
                     so 28 leaves a ~12px gap — matching the notifications popover. -->
                <AICreditGauge side="right" align="end" :side-offset="28" />
              </div>
            </SidebarMenuItem>
            <!-- Notifications — a popover beside the sidebar on desktop, the
                 /main/notifications page on mobile. The unread badge is hidden
                 in icon mode (no room), so a dot rides on the button instead. -->
            <SidebarMenuItem>
              <SharedNotifications>
                <SidebarMenuButton
                  tooltip="Notifications"
                  :is-active="route.path === '/main/notifications'"
                  class="relative"
                  @click="close"
                >
                  <Bell/>
                  <span>Notifications</span>
                  <span
                    v-if="hasUnread"
                    class="absolute left-5 top-1.5 hidden size-2 rounded-full bg-destructive ring-2 ring-sidebar group-data-[collapsible=icon]:block"
                  />
                </SidebarMenuButton>
              </SharedNotifications>
              <SidebarMenuBadge
                v-if="hasUnread"
                class="top-1.5 bg-destructive/15 text-destructive text-[10px] font-semibold"
              >
                {{ unreadBadge }}
              </SidebarMenuBadge>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Settings" :is-active="route.path.startsWith('/main/settings')">
                <NuxtLink to="/main/settings" @click="close">
                  <Settings/>
                  <span>Settings</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
<!--            <SidebarMenuItem>-->
<!--              <SidebarMenuButton as-child tooltip="Help" :is-active="route.path.startsWith('/main/help')">-->
<!--                <NuxtLink to="/main/help">-->
<!--                  <LifeBuoy/>-->
<!--                  <span>Help</span>-->
<!--                </NuxtLink>-->
<!--              </SidebarMenuButton>-->
<!--            </SidebarMenuItem>-->
            <!-- Theme toggle — collapses away in icon mode. -->
            <SidebarMenuItem class="group-data-[collapsible=icon]:hidden">
              <div class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                <span>Dark mode</span>
                <SharedDarkModeSwitch/>
              </div>
            </SidebarMenuItem>

            <!-- User profile + account menu. -->
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent"
                                     :tooltip="user.name">
                    <Avatar class="size-8 shrink-0 rounded-md">
                      <AvatarImage :src="user.avatar" :alt="user.name"/>
                      <AvatarFallback class="rounded-md bg-primary text-xs text-primary-foreground">
                        {{ userInitials(user.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid min-w-0 flex-1 text-left leading-tight">
                      <span class="truncate text-sm font-medium">{{ user.name }}</span>
                      <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
                    </div>
                    <ChevronsUpDown class="ml-auto size-4 shrink-0 text-muted-foreground"/>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="min-w-56 w-[--radix-dropdown-menu-trigger-width]" side="top" align="end">
                  <div class="flex items-center gap-2 px-2 py-1.5">
                    <Avatar class="size-8 shrink-0 rounded-md">
                      <AvatarImage :src="user.avatar" :alt="user.name"/>
                      <AvatarFallback class="rounded-md bg-primary text-xs text-primary-foreground">
                        {{ userInitials(user.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid min-w-0 flex-1 leading-tight">
                      <span class="truncate text-sm font-medium">{{ user.name }}</span>
                      <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem as-child>
                    <NuxtLink to="/main/settings" @click="close">
                      <UserIcon class="size-4"/>
                      <span>Account</span>
                    </NuxtLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child>
                    <NuxtLink to="/main/settings" @click="close">
                      <Settings class="size-4"/>
                      <span>Settings</span>
                    </NuxtLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem class="text-destructive focus:text-destructive" @click="signOutUser">
                    <LogOut class="size-4"/>
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <!-- Edge rail: click/drag to toggle in any state (expanded or collapsed). -->
        <SidebarRail/>
      </Sidebar>
      </LayoutSidebarCloseMobileOnClick>

      <!-- Chat-history flyout: sits beside the sidebar, full viewport height,
           dismissed by clicking away. Only ever open on desktop /main. -->
      <LayoutChatHistoryPanel v-model:open="historyOpen" />

      <!-- ── Main panel ──────────────────────────────────────────────── -->
      <SidebarInset class="relative min-h-0">
        <!-- Mobile-only bar: the sidebar is an offcanvas sheet on small
             screens, so its trigger must live outside it. Hidden on desktop,
             where the in-sidebar trigger + rail handle toggling. -->

        <SharedOfflineBanner/>
        <SharedBillingExpiryBanner class="xs:hidden"/>

        <div class="min-h-0 flex-1 flex-col flex w-full overflow-hidden">
          <!--                    <SharedDesktopTitleBar class="hidden lg:flex" />-->
          <div class="flex flex-col w-full h-full">
            <slot/>
          </div>

<!--          <SharedMobileNavigation class="w-full xs:hidden"/>-->
        </div>
      </SidebarInset>

      <!-- Floating assistant dock — a flex sibling AFTER <SidebarInset> so, on desktop,
           its slide-in panel occupies the far right and pushes the page left instead of
           covering it. Renders a launcher/panel only on pages that register a context
           (matter/vault/engagement/calendar) via provideDockContext(). -->
      <SharedAIAssistantDock />
    </SidebarProvider>
  </div>
</template>
