<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col lg:flex-row w-full p-3 gap-3 h-full overflow-hidden">
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
        </div>

        <!-- Mobile: List Layout -->
        <div class="flex lg:hidden flex-col w-full h-full overflow-y-scroll gap-4">
          <!-- Profile Card -->
          <div class="flex flex-col rounded-lg border bg-card">
            <div class="flex flex-row items-center gap-4 p-4">
              <Avatar class="size-16">
                <AvatarImage :src="getSignedInUser()?.avatar" alt="Profile" />
                <AvatarFallback class="text-lg bg-primary text-primary-foreground">
                  {{ getSignedInUser()?.name?.split(" ").at(0)?.at(0)?.toUpperCase() + getSignedInUser()?.name?.split(" ").at(1)?.at(0)?.toUpperCase() }}
                </AvatarFallback>
              </Avatar>

              <div class="flex flex-col flex-1">
                <span class="font-semibold text-lg">{{ getSignedInUser()?.name }}</span>
                <span class="text-sm text-muted-foreground">{{ getSignedInUser()?.email }}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              class="justify-center rounded-t-none border-t"
              size="sm"
              @click="navigateTo('/main/settings/profile')"
            >
              Edit profile
            </Button>
          </div>

          <!-- Preferences Section -->
          <div class="flex flex-col rounded-lg border bg-card overflow-hidden">
            <div class="p-3 border-b bg-muted/50">
              <span class="text-sm font-medium text-muted-foreground">Preferences</span>
            </div>

            <!-- Notifications and sounds -->
            <NuxtLink to="/main/settings/notifications" class="flex flex-row items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <Bell class="size-4" />
                </div>
                <span class="font-medium">Notifications and sounds</span>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </NuxtLink>
          </div>

          <!-- Account Section -->
          <div class="flex flex-col rounded-lg border bg-card overflow-hidden">
            <div class="px-4 py-3 border-b bg-muted/50">
              <span class="text-sm font-medium text-muted-foreground">Account</span>
            </div>

            <!-- Password -->
            <button class="flex flex-row items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <Lock class="size-4" />
                </div>
                <span class="font-medium">Password</span>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </button>

            <!-- Login with Face ID -->
            <button class="flex flex-row items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <Fingerprint class="size-4" />
                </div>
                <span class="font-medium">Login with Face ID</span>
              </div>
              <Switch :checked="true" />
            </button>

            <!-- Billing -->
            <NuxtLink to="/main/settings/billing" class="flex flex-row items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <CreditCard class="size-4" />
                </div>
                <span class="font-medium">Billing</span>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </NuxtLink>

            <!-- Support -->
            <button class="flex flex-row items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <HelpCircle class="size-4" />
                </div>
                <span class="font-medium">Support</span>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </button>

            <!-- Clear cache -->
            <button class="flex flex-row items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <Trash2 class="size-4" />
                </div>
                <span class="font-medium">Clear cache</span>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </button>

            <!-- Terms and Privacy Policy -->
            <button class="flex flex-row items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-muted">
                  <FileText class="size-4" />
                </div>
                <span class="font-medium">Terms and Privacy Policy</span>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </button>
          </div>

          <!-- Logout Button -->
          <div class="flex flex-col rounded-lg border bg-card overflow-hidden">
            <button class="flex flex-row items-center justify-between p-4 hover:bg-destructive/10 transition-colors">
              <div class="flex flex-row items-center gap-3">
                <div class="flex items-center justify-center size-9 rounded-full bg-destructive/20">
                  <LogOut class="size-4 text-destructive" />
                </div>
                <span class="font-medium text-destructive">Logout</span>
              </div>
              <ChevronRight class="size-5 text-destructive" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  ArrowLeft,
  Bell,
  CreditCard,
  ChevronRight,
  Languages,
  Palette,
  Lock,
  Fingerprint,
  HelpCircle,
  Trash2,
  FileText,
  LogOut
} from "lucide-vue-next"
import { getSignedInUser } from "~/services/auth"

definePageMeta({
  layout: 'default'
})

const activeTab = ref('profile')
const colorMode = useColorMode()
</script>