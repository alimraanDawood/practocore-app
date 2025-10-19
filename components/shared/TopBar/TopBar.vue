<template>
    <div class="flex flex-row w-full gap-1">
        <NuxtLink to="/main">
            <button class="p-2 border-b-2 border-transparent"
                :class="{ '!border-primary font-medium': $route?.name === 'main' }">Home</button>
        </NuxtLink>

        <NuxtLink to="/main/matters">
            <button class="p-2 border-b-2 border-transparent"
                :class="{ '!border-primary font-medium': $route?.name?.toString()?.startsWith('main-matters') }">Matters</button>
        </NuxtLink>

        <NuxtLink to="/main/calendar">
            <button class="p-2 border-b-2 border-transparent"
                :class="{ '!border-primary font-medium': $route?.name === 'main-calendar' }">Calendar</button>
        </NuxtLink>

        <NuxtLink to="/main/templates">
            <button class="p-2 border-b-2 border-transparent"
                :class="{ '!border-primary font-medium': $route?.name === 'main-templates' }">Templates</button>
        </NuxtLink>

        <!-- <button class="p-2 border-b-2 border-transparent">Team</button> -->

        <NuxtLink to="/main/settings">
            <button class="p-2 border-b-2 border-transparent" :class="{ '!border-primary font-medium': $route.name === 'main-settings' }">Settings</button>
        </NuxtLink>
    </div>
</template>