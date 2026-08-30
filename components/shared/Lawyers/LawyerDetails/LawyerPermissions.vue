<script setup lang="ts">
import {updateMemberPermissionsForOrganisation} from "~/services/admin";
import {getSignedInUser} from "~/services/auth";

const props = defineProps<{ lawyerId: string, permissions: string[] }>();
const updating = ref(false);

const permissions = ref<string[]>([...props.permissions]);
const loading = ref(false);
const organisationId = getSignedInUser()?.organisation;

watch(() => props.permissions, value => { permissions.value = [...value]; });

const togglePermission = async (permission: string, value : boolean) => {
  try {
    updating.value = true;

    if (!organisationId) throw new Error('No active organisation selected');
    const next = value ? [...permissions.value, permission] : permissions.value.filter(p => p !== permission);
    const status = await updateMemberPermissionsForOrganisation(props.lawyerId, organisationId, next);
    permissions.value = status.permissions;
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
  {
    value: "canManageTemplates",
    label: "Can Manage Firm Templates",
    description: "Allows the lawyer to edit engagement playbooks and firm procedures authored by a colleague. Everyone can always create their own and edit what they authored."
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
            <Switch :model-value="permissions.includes(permission?.value)" @update:model-value="v => togglePermission(permission?.value, v)" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
