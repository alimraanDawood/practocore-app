<script setup lang="ts">
import {updateMemberPermissionsForOrganisation, apiErrorMessage} from "~/services/admin";
import {getSignedInUser} from "~/services/auth";
import {toast} from "vue-sonner";

const props = defineProps<{ lawyerId: string, permissions: string[], roleLabel?: string, overridden?: string[] }>();

const permissions = ref<string[]>([...props.permissions]);
// `updating` was declared and never bound to anything, and a `loading` ref was
// declared, never set, and used to gate the entire template — so the table
// rendered only because the value it guarded stayed false by accident. Now the
// switches disable while a change is in flight, which is what stops an admin
// flipping three of them into three racing requests over the same row.
const updating = ref(false);
const organisationId = getSignedInUser()?.organisation;

// The directory shows resolved access; a change here has to reach it.
const refreshSignal = useState<number>('lawyersDirectoryRefresh', () => 0);

watch(() => props.permissions, value => { permissions.value = [...value]; });

const togglePermission = async (permission: string, value: boolean) => {
  if (updating.value) return;
  const previous = [...permissions.value];
  updating.value = true;
  try {
    if (!organisationId) throw new Error('No active organisation selected');
    const next = value
        ? [...permissions.value, permission]
        : permissions.value.filter(p => p !== permission);
    const status: any = await updateMemberPermissionsForOrganisation(props.lawyerId, organisationId, next);
    // The SERVER's answer, not the requested set. They differ for an owner or an
    // admin, who hold everything whatever these switches say — echoing the
    // request back would show them as restricted while every collection rule
    // treated them as unrestricted.
    permissions.value = status?.permissions ?? next;
    refreshSignal.value++;
    toast.success('Permissions updated');
  } catch (e) {
    // A failure used to be a console.error and nothing else: the switch stayed
    // where the admin left it, so the screen showed a permission that had not
    // been granted.
    console.error(e);
    permissions.value = previous;
    toast.error(apiErrorMessage(e, 'Could not update permissions'));
  } finally {
    updating.value = false;
  }
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
  <div class="flex flex-col gap-2">
    <p v-if="roleLabel" class="text-xs text-muted-foreground">
      These switches are the difference from what a
      <span class="font-medium">{{ roleLabel }}</span> holds at this firm. Anything
      you change here stays with this person when the role itself is edited.
    </p>
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
            <Switch
                :model-value="permissions.includes(permission?.value)"
                :disabled="updating"
                @update:model-value="v => togglePermission(permission?.value, v)"
            />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
