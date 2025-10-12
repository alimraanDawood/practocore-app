<template>
    <div class="flex flex-row px-3 h-16 shrink-0 justify-around items-center border-t bg-background">
        <NuxtLink to="/main">
            <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main' }">
                <Home class="size-5" />
                <span>Home</span>
            </button>
        </NuxtLink>
        
        <NuxtLink to="/main/projects">
            <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-projects' }">
                <Scale class="size-5" />
                <span>Projects</span>
            </button>
        </NuxtLink>

        <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-calendar' }">
            <CalendarIcon class="size-5" />
            <span>Calendar</span>
        </button>

        <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-team' }">
            <Users class="size-5" />
            <span>Team</span>
        </button>

        <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-settings' }">
            <Settings class="size-5" />
            <span>Settings</span>
        </button>
    </div>
</template>

<script setup>
import { Plus, Home, Settings, Scale, CalendarIcon, Users } from 'lucide-vue-next';
</script>