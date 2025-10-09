<template>
    <div class="flex flex-row px-3 h-16 shrink-0 justify-around items-center border-t bg-accent">
        <Button variant="ghost" size="icon">
            <Home />
        </Button>

        <SharedProjectsCreateProject>
            <Button size="icon">
                <Plus />
            </Button>
        </SharedProjectsCreateProject>

        <Button variant="ghost" size="icon">
            <Settings />
        </Button>
    </div>
</template>

<script setup>
import { Plus, Home, Settings } from 'lucide-vue-next';
</script>