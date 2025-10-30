<script setup>

import {getInvites, subscribeToInvites} from "~/services/admin/index.js";
import DataTable from "~/components/ui/data-table/DataTable.vue";
import {desktopColumns, mobileColumns} from "~/components/PageComponents/Organisation/Invitations/columns.js";

const invites = ref(null);

onMounted(async () => {
  loadInvites();

  subscribeToInvites(loadInvites);
});

const loadInvites = async () => {
  invites.value = await getInvites(1, 10, {});
}

</script>

<template>
  <div class="flex flex-col">

    <DataTable :columns="$viewport.isGreaterOrEquals('customxs') ? desktopColumns : mobileColumns" :data="invites?.items || []" />
  </div>
</template>