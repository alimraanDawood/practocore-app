<script lang="ts" setup>
// App-shell layout: a collapsible sidebar (modeled on the assistant page's
// shell) that wraps every page rendered into <slot />. Pages opt out with
// `definePageMeta({ layout: 'blank' })` (or another layout).
import {
  ChevronsUpDown, MessageSquareText, FolderLock, LifeBuoy, Settings,
  Scale, Home, Users, Building2, CalendarClock, LogOut, User as UserIcon,
  type LucideIcon, Plus, Workflow, Scroll, Telescope, Briefcase, ShieldCheck,
} from 'lucide-vue-next';
import {getSignedInUser, signOut} from '~/services/auth';
import AICreditGauge from '~/components/shared/AI/AICreditGauge.vue';
import {useAuthStore} from '~/stores/auth';
import {useOrganisationStore} from '~/stores/organisation';

const workspace = 'PractoCore';
const route = useRoute();
const authStore = useAuthStore();
authStore.init();

useOfflineSync();

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

interface NavLink {
  label: string;
  icon: LucideIcon;
  to: string;
  exact?: boolean;
  adminOnly?: boolean;
  needsOrg?: boolean;
  beta?: boolean;
}

const hasOrg = computed(() => !!getSignedInUser()?.organisation);

const appNav: NavLink[] = [
  // { label: 'Home', icon: Home, to: '/main', exact: true },
  {label: 'Assistant', icon: MessageSquareText, to: '/main', exact: true},
  {label: 'Litigation', icon: Scale, to: '/main/matters'},
  {label: 'Engagements', icon: Briefcase, to: '/main/engagements', beta: true},
  {label: 'Compliance', icon: ShieldCheck, to: '/main/compliance', beta: true},
  {label: 'Calendar', icon: CalendarClock, to: '/main/calendar'},
  {label: 'Vault', icon: FolderLock, to: '/main/vault'},
  {label: 'Skills', icon: Scroll, to: '/main/skills'},
  // Workflows + Deep Research hidden from the UI for now (routes/backend remain intact).
  {label: 'Workflows', icon: Workflow, to: '/main/workflows', beta: true},
  {label: 'Research', icon: Telescope, to: '/main/research', beta: true},
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
</script>

<template>
  <div class="flex h-svh flex-col safe-area-shell">

    <SidebarProvider class="min-h-0 flex-1 overflow-hidden">
      <!-- Mobile/touch gestures: left-edge swipe opens the offcanvas sidebar,
           swipe-back closes it, and navigation auto-closes it. -->
      <LayoutSidebarMobileGestures />
      <!-- ── Sidebar ─────────────────────────────────────────────────── -->
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
                <SidebarMenuButton class="border" tooltip="New chat" @click="$router.push('/main')">
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
                  <SidebarMenuButton as-child :tooltip="item.label" :is-active="isActive(item)">
                    <NuxtLink :to="item.to">
                      <component :is="item.icon"/>
                      <span>{{ item.label }}</span>
                    </NuxtLink>
                  </SidebarMenuButton>
                  <SidebarMenuBadge
                    v-if="item.beta"
                    class="bg-primary/10 text-primary text-[10px] font-medium uppercase tracking-wide"
                  >
                    Beta
                  </SidebarMenuBadge>
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
                <AICreditGauge />
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Settings" :is-active="route.path.startsWith('/main/settings')">
                <NuxtLink to="/main/settings">
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
                    <NuxtLink to="/main/settings">
                      <UserIcon class="size-4"/>
                      <span>Account</span>
                    </NuxtLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child>
                    <NuxtLink to="/main/settings">
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
