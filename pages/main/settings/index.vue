<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <!-- On desktop the tab row below carries the rule, so the title and its tabs
         read as one block (mobile keeps the header's own border). -->
    <div class="flex flex-row items-center p-3 border-b lg:border-b-0 lg:pb-1 justify-between w-full">
      <div class="flex items-center gap-2">
        <SidebarTrigger class="lg:hidden"/>
        <span class="font-semibold text-xl ibm-plex-serif">Settings</span>
      </div>
    </div>

    <div class="flex flex-col flex-1 min-h-0 w-full">
      <div class="flex flex-col w-full flex-1 min-h-0 overflow-hidden">
        <!-- Desktop: horizontal tab row. The app shell already owns the left
             sidebar, so a second vertical rail here read as a competing nav —
             the sections sit in a row under the page title instead. -->
        <div class="hidden lg:flex w-full shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2">
          <template v-for="tab in visibleTabs" :key="tab.key">
            <span v-if="tab.startsGroup" class="mx-1.5 h-5 w-px shrink-0 bg-border" />
            <Button
                size="sm"
                class="shrink-0 whitespace-nowrap"
                :variant="activeTab === tab.key ? 'secondary' : 'ghost'"
                @click="activeTab = tab.key"
            >{{ tab.label }}</Button>
          </template>
        </div>

        <!-- Desktop: Tab Content -->
        <div class="hidden lg:flex flex-col w-full flex-1 min-h-0 overflow-y-auto p-4">
          <PageComponentsSettingsProfile v-if="activeTab === 'profile'"/>
          <PageComponentsSettingsNotifications v-if="activeTab === 'notifications'"/>
          <PageComponentsSettingsAIProviders v-if="activeTab === 'ai'"/>
          <div v-if="activeTab === 'billing' && canSeeBilling" class="flex flex-col w-full gap-6">
            <div class="flex flex-col">
              <h2 class="text-2xl font-semibold ibm-plex-serif">Billing</h2>
              <p class="text-sm text-muted-foreground">Manage your subscription and billing information.</p>
            </div>
            <Separator/>
            <SharedBilling/>
            <SharedBillingAiCredits/>

          </div>
          <PageComponentsSettingsEccmis v-if="activeTab === 'eccmis'" />
          <PageComponentsSettingsDocumentation v-if="activeTab === 'documentation'" />
          <PageComponentsSettingsSupport v-if="activeTab === 'support'" />
        </div>

        <!-- Mobile: List Layout -->
        <div class="flex lg:hidden flex-col w-full p-5 flex-1 min-h-0 overflow-y-auto gap-5">
          <!-- Profile Card -->
          <div class="flex flex-col rounded-lg gap-2">
            <div class="flex flex-row items-center gap-2">
              <Avatar class="size-12">
                <AvatarImage :src="getSignedInUser()?.avatar" alt="Profile"/>
                <AvatarFallback class=" bg-primary text-primary-foreground">
                  {{
                    getSignedInUser()?.name?.split(" ").at(0)?.at(0)?.toUpperCase() + getSignedInUser()?.name?.split(" ").at(1)?.at(0)?.toUpperCase()
                  }}
                </AvatarFallback>
              </Avatar>

              <div class="flex flex-col flex-1">
                <span class="font-semibold text-lg">{{ getSignedInUser()?.name }}</span>
                <span class="text-sm text-muted-foreground">{{ getSignedInUser()?.email }}</span>
              </div>
            </div>

            <Button
                class="w-fit"
                size="sm"
                @click="navigateTo('/main/settings/profile')"
            >
              Edit profile
            </Button>
          </div>

          <!-- Preferences Section -->
          <div class="flex flex-col gap-2">
            <span class="font-semibold">Preferences</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <NuxtLink to="/main/settings/notifications" class="w-full">
                <Button variant="ghost" class="justify-between items-center w-full">
                  <div class="flex flex-row justify-center items-center gap-2">
                    <Bell/>
                    Notifications
                  </div>
                  <ChevronRight class="size-5 text-muted-foreground"/>
                </Button>
              </NuxtLink>

              <NuxtLink to="/main/settings/ai" class="w-full">
                <Button variant="ghost" class="justify-between items-center w-full">
                  <div class="flex flex-row justify-center items-center gap-2">
                    <Sparkles/>
                    AI Provider
                  </div>
                  <ChevronRight class="size-5 text-muted-foreground"/>
                </Button>
              </NuxtLink>

              <Button variant="ghost" class="justify-between items-center">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Moon/>
                  Dark Mode
                </div>
                <SharedDarkModeSwitch/>
              </Button>
            </div>
          </div>

          <div v-if="authStore.isAdmin && getSignedInUser()?.organisation" class="flex flex-col gap-2">
            <span class="font-semibold">Organisation</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center"
                      @click="navigateTo('/main/settings/organisation')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Building2/>
                  Organisation Profile
                </div>
                <ChevronRight class="size-5 text-muted-foreground"/>
              </Button>
            </div>
          </div>

          <div v-if="(getSignedInUser()?.organisation && authStore.isAdmin) || !getSignedInUser()?.organisation"
               class="flex flex-col gap-2">
            <span class="font-semibold">Advanced</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center"
                      @click="navigateTo('/main/settings/billing')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <CreditCard/>
                  Billing
                </div>
                <ChevronRight class="size-5 text-muted-foreground"/>
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-semibold">Integrations</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center" @click="navigateTo('/main/settings/eccmis')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Globe />
                  ECCMIS Sync
                </div>
                <ChevronRight class="size-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-semibold">Help Center</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center"
                      @click="navigateTo('/main/settings/documentation')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <BookOpen/>
                  Documentation
                </div>
                <ChevronRight class="size-5 text-muted-foreground"/>
              </Button>

              <Button variant="ghost" class="justify-between items-center"
                      @click="navigateTo('/main/settings/support')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Headset/>
                  Contact Support
                </div>
                <ChevronRight class="size-5 text-muted-foreground"/>
              </Button>
            </div>
          </div>

          <div class="flex flex-col">
            <Button class="justify-start" variant="destructive" @click="signOutUser">
              <LogOut/>

              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, computed} from 'vue'
import {
  Bell,
  CreditCard,
  ChevronRight,
  LogOut,
  Headset,
  BookOpen,
  Building2,
  Globe,
  Users,
  UserPlus,
  Moon, Sparkles, WifiOff
} from "lucide-vue-next"
import {getSignedInUser, signOut} from "~/services/auth"

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()

// Tab selection is URL-backed (`?tab=`) so links can land on a specific panel
// (e.g. the AI can send a user straight to Billing). Unknown/missing → profile.
const VALID_TABS = ['profile', 'notifications', 'ai', 'billing', 'eccmis', 'documentation', 'support']
const activeTab = computed({
  get() {
    const t = route.query.tab
    return typeof t === 'string' && VALID_TABS.includes(t) ? t : 'profile'
  },
  set(t) {
    router.replace({ query: { ...route.query, tab: t } })
  },
})

const signOutUser = () => {
  signOut()
  window.location.reload()
}

const authStore = useAuthStore();

// Show billing for: org admins, or solo practitioners (no organisation)
const canSeeBilling = computed(() => {
  const user = getSignedInUser();
  if (user?.organisation) {
    return authStore.isAdmin;
  }
  return true;
});

// Desktop tab row. `startsGroup` draws the divider that separates the account
// sections from the integrations/help ones — what the old vertical rail used a
// <Separator> for.
const visibleTabs = computed(() => [
  { key: 'profile', label: 'Profile', show: true },
  { key: 'notifications', label: 'Notifications', show: true },
  { key: 'ai', label: 'AI Provider', show: true },
  { key: 'billing', label: 'Billing', show: canSeeBilling.value },
  { key: 'eccmis', label: 'ECCMIS Sync', show: true, startsGroup: true },
  { key: 'documentation', label: 'Documentation', show: true },
  { key: 'support', label: 'Support', show: true },
].filter(t => t.show));
</script>