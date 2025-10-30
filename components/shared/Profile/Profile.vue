<template>
  <Avatar v-if="authStore.organisations.length === 0">
    <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue"/>
    <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{ getSignedInUser()?.name?.split(" ").at(0).at(0).toUpperCase() + getSignedInUser()?.name?.split(" ").at(1).at(0).toUpperCase() }}</AvatarFallback>
  </Avatar>
  <div v-else>
    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')">
      <DialogTrigger as-child>
        <Avatar>
          <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue"/>
          <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{ getSignedInUser()?.name?.split(" ").at(0).at(0).toUpperCase() + getSignedInUser()?.name?.split(" ").at(1).at(0).toUpperCase() }}</AvatarFallback>
        </Avatar>
      </DialogTrigger>
      <DialogContent side="bottom">
        <DialogHeader>
          <DialogTitle>Select an Organisation</DialogTitle>
        </DialogHeader>

        <OrganisationSelector/>

      </DialogContent>
    </Dialog>

    <Sheet v-else>
      <SheetTrigger as-child>
        <Avatar>
          <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue"/>
          <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{ getSignedInUser()?.name?.split(" ").at(0).at(0).toUpperCase() + getSignedInUser()?.name?.split(" ").at(1).at(0).toUpperCase() }}</AvatarFallback>
        </Avatar>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Select an Organisation</SheetTitle>
        </SheetHeader>

        <div class="p-5 flex flex-col">

          <OrganisationSelector/>
        </div>

      </SheetContent>
    </Sheet>
  </div>

</template>

<script setup>
import {ChevronsUpDown} from 'lucide-vue-next';
import {getSignedInUser} from '~/services/auth';
import OrganisationSelector from './OrganisationSelector.vue';

const authStore = useAuthStore();

onMounted(() => {
  authStore.init();
})
</script>