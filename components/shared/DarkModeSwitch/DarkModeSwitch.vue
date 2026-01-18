<template>
  <Switch :model-value="isDark" @update:model-value="toggleTheme">
    <template #thumb>
        <div class="w-full h-full grid place-items-center">
            <Moon v-if="isDark" class=" mx-auto my-auto size-3 text-black" />
            <Sun v-else class=" mx-auto my-auto size-3 text-black" />
        </div>
    </template>
  </Switch>
</template>

<script setup>
import { Sun, Moon } from 'lucide-vue-next';

const colorMode = useColorMode()

const isDark = computed(() => {
    return colorMode.preference === 'dark'
});


const toggleTheme = () => {
    colorMode.preference = isDark.value ? 'light' : 'dark'; 
}
</script>