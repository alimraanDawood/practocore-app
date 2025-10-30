<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import UsersTable from "~/components/PageComponents/Organisation/Users/UsersTable/UsersTable.vue";
import {desktopColumns, mobileColumns} from './UsersTable/columns';
import {getOrganisationUsers} from "~/services/admin";
import InviteUser from "~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue";

const users = ref(null);

onMounted(  async () => {
  users.value = await getOrganisationUsers(1, 10, {});
});

</script>

<template>
  <div class="flex flex-col w-full h-full  gap-3">
    <div class="flex flex-col lg:flex-row w-full gap-3">
      <div class="flex flex-col">
        <span class="text-2xl font-semibold ibm-plex-serif">User Management</span>
        <span class="text-sm text-muted-foreground">Manage your team members and other account permissions here.</span>
      </div>

      <div class="flex flex-row w-full lg:w-fit lg:ml-auto">
        <InviteUser>
          <Button class="w-full lg:w-fit"><Plus />  Invite Member</Button>
        </InviteUser>
      </div>
    </div>
    <UsersTable :columns="$viewport.isGreaterOrEquals('customxs') ? desktopColumns : mobileColumns" :data="users?.items || []" />
  </div>
</template>

<style scoped>

</style>