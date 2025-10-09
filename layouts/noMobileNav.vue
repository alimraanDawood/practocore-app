<template>
    <div class="flex flex-col bg-background text-foreground h-[100dvh] w-screen">
        <div class="flex flex-row w-full items-center justify-between p-3 border-b">
            <Button @click="$router.go(-1)" size="icon" variant="ghost">
                <ArrowLeft />
            </Button>

            <Button size="icon" variant="secondary">
                <Bell />
            </Button>
        </div>

        <div class="flex flex-col h-full w-full overflow-y-scroll">
            <slot />
        </div>

    </div>
</template>

<script setup lang="ts">
import { Bell, ArrowLeft } from 'lucide-vue-next';
</script>