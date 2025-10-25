<template>
    <Dialog v-if="$viewport.isGreaterThan('tablet')">
        <DialogTrigger as-child>
            <Avatar>
                <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue" />
                <AvatarFallback class="text-xs bg-primary text-primary-foreground">AD</AvatarFallback>
            </Avatar>
        </DialogTrigger>
        <DialogContent side="bottom">
            <DialogHeader>
                <DialogTitle>Select an Organisation</DialogTitle>
            </DialogHeader>

            <OrganisationSelector />
                
        </DialogContent>
    </Dialog>
    
    <Sheet v-else>
        <SheetTrigger as-child>
            <Avatar>
                <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue" />
                <AvatarFallback class="text-xs bg-primary text-primary-foreground">AD</AvatarFallback>
            </Avatar>
        </SheetTrigger>
        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Select an Organisation</SheetTitle>
            </SheetHeader>

            <OrganisationSelector />
                
        </SheetContent>
    </Sheet>

</template>

<script setup>
import { ChevronsUpDown } from 'lucide-vue-next';
import { getSignedInUser } from '~/services/auth';
import OrganisationSelector from './OrganisationSelector.vue';
</script>