<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col lg:flex-row w-full gap-3 h-full overflow-hidden">
        <!-- Desktop: Tabs Layout -->
        <div class="hidden lg:flex flex-row bg-muted lg:bg-background p-1 rounded-lg w-fit items-center lg:items-start lg:flex-col lg:max-w-[150px] lg:w-full overflow-x-scroll overflow-y-hidden py-1 lg:h-full gap-3">
          <Button
              size="sm"
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'profile' ? 'default' : 'ghost'"
              @click="activeTab = 'profile'"
          >Profile
          </Button>
          <Button
              size="sm"
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'notifications' ? 'default' : 'ghost'"
              @click="activeTab = 'notifications'"
          >Notifications
          </Button>
          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'billing' ? 'default' : 'ghost'"
              @click="activeTab = 'billing'">
            Billing
          </Button>
          <Separator class="my-1" />
          <Button
              size="sm"
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'documentation' ? 'default' : 'ghost'"
              @click="activeTab = 'documentation'"
          >Documentation
          </Button>
          <Button
              size="sm"
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'support' ? 'default' : 'ghost'"
              @click="activeTab = 'support'"
          >Support
          </Button>
        </div>

        <!-- Desktop: Tab Content -->
        <div class="hidden lg:flex flex-col w-full h-full overflow-y-scroll">
          <PageComponentsSettingsProfile v-if="activeTab === 'profile'"/>
          <PageComponentsSettingsNotifications v-if="activeTab === 'notifications'"/>
          <div v-if="activeTab === 'billing'" class="flex flex-col w-full gap-6">
            <div class="flex flex-col">
              <h2 class="text-2xl font-semibold ibm-plex-serif">Billing</h2>
              <p class="text-sm text-muted-foreground">Manage your subscription and billing information.</p>
            </div>
            <Separator/>
            <SharedBilling />
          </div>
          <PageComponentsSettingsDocumentation v-if="activeTab === 'documentation'" />
          <PageComponentsSettingsSupport v-if="activeTab === 'support'" />
        </div>

        <!-- Mobile: List Layout -->
        <div class="flex lg:hidden flex-col w-full p-5 h-full overflow-y-scroll gap-5">
          <!-- Profile Card -->
          <div class="flex flex-col rounded-lg gap-2">
            <div class="flex flex-row items-center gap-2">
              <Avatar class="size-12">
                <AvatarImage :src="getSignedInUser()?.avatar" alt="Profile" />
                <AvatarFallback class=" bg-primary text-primary-foreground">
                  {{ getSignedInUser()?.name?.split(" ").at(0)?.at(0)?.toUpperCase() + getSignedInUser()?.name?.split(" ").at(1)?.at(0)?.toUpperCase() }}
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
                    <Bell />
                    Notifications
                  </div>
                  <ChevronRight class="size-5 text-muted-foreground" />
                </Button>
              </NuxtLink>

              <Button variant="ghost" class="justify-between items-center">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Moon />
                  Dark Mode
                </div>
                <SharedDarkModeSwitch />
              </Button>
            </div>
          </div>

          <div v-if="authStore.isAdmin && getSignedInUser()?.organisation" class="flex flex-col gap-2">
            <span class="font-semibold">Organisation</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center" @click="navigateTo('/main/settings/organisation')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Building2 />
                  Organisation Profile
                </div>
                <ChevronRight class="size-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-semibold">Advanced</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center" @click="navigateTo('/main/settings/billing')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <CreditCard />
                  Billing
                </div>
                <ChevronRight class="size-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-semibold">Help Center</span>
            <div class="flex flex-col bg-muted p-1 gap-3 rounded-lg border">
              <Button variant="ghost" class="justify-between items-center" @click="navigateTo('/main/settings/documentation')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <BookOpen />
                  Documentation
                </div>
                <ChevronRight class="size-5 text-muted-foreground" />
              </Button>

              <Button variant="ghost" class="justify-between items-center" @click="navigateTo('/main/settings/support')">
                <div class="flex flex-row justify-center items-center gap-2">
                  <Headset />
                  Contact Support
                </div>
                <ChevronRight class="size-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div class="flex flex-col">
            <Button class="justify-start" variant="destructive" @click="signOutUser">
              <LogOut />

              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  Bell,
  CreditCard,
  ChevronRight,
  LogOut,
  Headset,
  BookOpen,
  Building2,
  Users,
  UserPlus,
  Moon
} from "lucide-vue-next"
import { getSignedInUser, signOut } from "~/services/auth"

definePageMeta({
  layout: 'default'
})

const activeTab = ref('profile')

const signOutUser = () => {
  signOut()
  window.location.reload()
}

const authStore = useAuthStore();
</script>