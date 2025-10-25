<template>
    <div class="flex flex-row px-3 h-16 shrink-0 justify-around items-center border-t bg-background">
        <NuxtLink to="/main">
            <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main' }">
                <Home class="size-5" />
                <span>Home</span>
            </button>
        </NuxtLink>
        
        <NuxtLink to="/main/matters">
            <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-matters' }">
                <Scale class="size-5" />
                <span>Matters</span>
            </button>
        </NuxtLink>

        <NuxtLink to="/main/calendar">
            <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-calendar' }">
                <CalendarIcon class="size-5" />
                <span>Calendar</span>
            </button>
        </NuxtLink>

        <NuxtLink to="/main/templates">
            <button class="flex flex-col items-center disabled:opacity-50 text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-templates' }">
                <ScrollText class="size-5" />
                <span>Templates</span>
            </button>
        </NuxtLink>

        <!-- <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-team' }">
            <Users class="size-5" />
            <span>Team</span>
        </button> -->



        <NuxtLink to="/main/settings">
            <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-settings' }">
                <Settings class="size-5" />
                <span>Settings</span>
            </button>
        </NuxtLink>
    </div>
</template>

<script setup>
import { Plus, Home, Settings, Scale, CalendarIcon, Users, ScrollText } from 'lucide-vue-next';
</script>