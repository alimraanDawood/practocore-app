<template>
  <div class="flex flex-row px-3 h-16 shrink-0 justify-around items-center border-t bg-background">
    <button
        v-for="item in visibleTabs"
        :key="item.tab"
        @click="onTabClick(item.tab)"
        class="flex flex-col items-center text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px] transition-colors"
        :class="{ 'font-semibold text-primary': activeTab === item.tab }">
      <component :is="item.icon" class="size-5" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Home, Settings, Scale, CalendarIcon, Users } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const authStore = useAuthStore()
const { navigateToTab, activeTab } = useTabHistory()

const allTabs = [
  { tab: 'main',     label: 'Home',     icon: Home,         adminOnly: false },
  { tab: 'matters',  label: 'Matters',  icon: Scale,        adminOnly: false },
  { tab: 'calendar', label: 'Calendar', icon: CalendarIcon, adminOnly: false },
  { tab: 'lawyers',  label: 'Lawyers',  icon: Users,        adminOnly: true  },
  { tab: 'settings', label: 'Settings', icon: Settings,     adminOnly: false },
]

const visibleTabs = computed(() =>
  allTabs.filter(t => !t.adminOnly || authStore.isAdmin)
)

const onTabClick = async (tab: string) => {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.impact({ style: ImpactStyle.Light }) } catch {}
  }
  navigateToTab(tab)
}

onMounted(() => {
  authStore.init()
})
</script>