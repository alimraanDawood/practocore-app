<template>
  <div class="fixed bottom-0 left-0 dark flex flex-row gap-6 p-3 justify-center">
    <div class="flex flex-row w-fit p-3 gap-6 h-16 shrink-0 justify-around items-center border-t bg-background rounded-full iems-center">
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

    <div class="bg-background dark p-3 rounded-full">
      <SidebarTrigger>
        <button
            class="flex flex-col items-center text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px] transition-colors">
          <Ellipsis class="size-5" />
          <span>More</span>
        </button>
      </SidebarTrigger>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Home, Settings, Scale, CalendarIcon, Users, FolderLock, Ellipsis } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const authStore = useAuthStore()
const { navigateToTab, activeTab } = useTabHistory()

const allTabs = [
  { tab: 'main',     label: 'Home',     icon: Home,         adminOnly: false },
  { tab: 'matters',  label: 'Matters',  icon: Scale,        adminOnly: false },
  { tab: 'vault',    label: 'Vault',    icon: FolderLock,   adminOnly: false },
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