<template>
    <div class="flex flex-col  h-[100dvh] w-screen items-center overflow-hidden">

        <div class="bg-background lg:flex flex-col w-full border-b items-center hidden">
            <div class="flex flex-col w-full lg:w-[95vw] bg-background gap-4 text-foreground p-5 pb-0 h-full">
                <div class="flex flex-row items-center gap-2">
                    <img src="@/assets/img/logos/Practo Core Horizontal.svg" class="w-44 dark:hidden" />
                    <img src="@/assets/img/logos/Practo Core Horizontal -- Dark.svg" class="w-44 dark:block hidden" />


                    <SharedSearch></SharedSearch>

                    <div class="flex flex-row ml-auto items-center gap-2">
                        <SharedDarkModeSwitch />
                    
                        <Button variant="secondary" size="icon">
                            <MessageSquareText />
                        </Button>

                        <Button variant="secondary" size="icon">
                            <Bell />
                        </Button>

                        <div class="flex flex-row items-center gap-1">
                            <SharedProfile />
                        </div>
                    </div>
                </div>

                <SharedTopBar />

            </div>
        </div>

        <slot />
    </div>
</template>

<script setup>
import { Search, MessageSquareText, ChevronDown, Bell, ArrowLeft } from 'lucide-vue-next';
import { getSignedInUser } from '~/services/auth';

const hours = new Date().getHours();

const welcomeMessage = computed(() => {
    if (hours < 12) return 'Good Morning';
    if (hours < 18) return 'Good Afternoon';
    return 'Good Evening';
});
</script>