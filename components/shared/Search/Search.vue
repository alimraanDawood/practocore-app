<template>
    <Button @click="open = true" variant="outline" size="sm" class="w-[240px] flex flex-row justify-start">
        <SearchIcon /> Search
    </Button>

    <CommandDialog :open="open" @update:open="handleOpenChange">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
                <CommandItem value="calendar">
                    Calendar
                </CommandItem>
                <CommandItem value="search-emoji">
                    Search Emoji
                </CommandItem>
                <CommandItem value="calculator">
                    Calculator
                </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
                <CommandItem value="profile">
                    Profile
                </CommandItem>
                <CommandItem value="billing">
                    Billing
                </CommandItem>
                <CommandItem value="settings">
                    Settings
                </CommandItem>
            </CommandGroup>
        </CommandList>
    </CommandDialog>
</template>

<script setup>
import { SearchIcon } from 'lucide-vue-next'
import { useMagicKeys } from '@vueuse/core'

import { ref, watch } from 'vue'

const open = ref(false)

const keys = useMagicKeys()
const CmdJ = keys['Cmd+J']

function handleOpenChange() {
    open.value = !open.value
}

watch(CmdJ, (v) => {
    if (v)
        handleOpenChange()
})
</script>