<template>
    <div class="flex flex-col h-full border-r bg-background p-3 gap-3">
        <img src="@/assets/img/logos/Practo Core Square.png" class="size-10" />
        
        <div class="flex flex-col gap-1">
            <Button variant="ghost" size="icon">
                <Home />
            </Button>
            
            <Button variant="ghost" size="icon">
                <Users />
            </Button>
            
            
        </div>
        
        <div class="flex flex-col mt-auto gap-1">
            <Button variant="ghost" size="icon">
                <Settings />
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Home, Users, Settings } from 'lucide-vue-next';
</script>