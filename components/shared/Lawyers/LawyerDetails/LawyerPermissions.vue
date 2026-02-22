<script setup lang="ts">
import {getUserPermissions, updateUserPermissions} from "~/services/admin";

const props = defineProps(['permissionId']);
const updating = ref(false);

const permissions = ref<null | any>(null);

const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  permissions.value = await getUserPermissions(props.permissionId);
  loading.value = false;
})

const togglePermission = async (permission: string, value : boolean) => {
  try {
    updating.value = true;

    const status = await updateUserPermissions(props.permissionId, value ? { "permissions": [...permissions?.value?.permissions, permission] } : { "permissions": permissions?.value?.permissions?.filter(p => p != permission) } )
    permissions.value = status;
    console.log(`Permission ${permission} as ${value}`);
  } catch (e) {
    console.error(e);
  }
  updating.value = false;
}

const Permissions = [
  {
    value: "canCreateMatters",
    label: "Can Create Matters",
    description: "Allows the lawyer to create new matters in the system."
  },
  {
    value: "canDeleteMatters",
    label: "Can Delete Matters",
    description: "Allows the lawyer to delete existing matters from the system."
  },
  {
    value: "canViewExternalMatters",
    label: "Can View External Matters",
    description: "Allows the lawyer to view matters that they are not a member of."
  },
  {
    value: "canCreateApplications",
    label: "Can Add Applications in Matters",
    description: "Allows the lawyer to add applications to matters that they are not a member of."
  },
]
</script>

<template>
  <div class="flex flex-col" v-if="!loading">
    <Table class="border">
      <TableHeader>
        <TableRow class="divide-x bg-muted/70 text-muted-foreground">
          <TableHead>
            Permission
          </TableHead>
          <TableHead>
            Status
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody class="divide-y">
        <TableRow class="divide-x" v-for="permission in Permissions">
          <TableCell>
            <div class="flex flex-col">
              <span class="font-semibold">{{ permission.label }}</span>
              <span class="text-sm text-wrap text-muted-foreground">{{permission?.description}}</span>
            </div>
          </TableCell>

          <TableCell>
            <Switch :model-value="permissions?.permissions?.includes(permission?.value)" @update:model-value="v => togglePermission(permission?.value, v)" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>