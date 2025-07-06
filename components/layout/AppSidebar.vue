<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { navMenu, navMenuBottom } from '~/constants/menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const teams: {
  name: string
  logo: string
  plan: string
}[] = [
  {
    name: 'SupaDuuka Kiosk -- 3455',
    logo: 'i-lucide-gallery-vertical-end',
    plan: 'TLA',
  },
  {
    name: 'SupaDuuka Kiosk -- 5673',
    logo: 'i-lucide-audio-waveform',
    plan: 'TLA',
  },
  {
    name: 'SupaDuuka Mart -- 12',
    logo: 'i-lucide-command',
    plan: 'TLA',
  },
]

const user: {
  name: string
  email: string
  avatar: string
} = {
  name: 'Al-imraan Dawood',
  email: 'alimraandawoodgulam@gmail.com',
  avatar: '/avatars/avatartion.png',
}

</script>

<template>
  <Sidebar collapsible="icon" side="left" variant="sidebar">
    <SidebarHeader>
      <LayoutSidebarNavHeader :teams="teams" />
      <Search />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in navMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in navMenuBottom" :key="index" :item="item" size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <LayoutSidebarNavFooter :user="user" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>

<style scoped>

</style>
