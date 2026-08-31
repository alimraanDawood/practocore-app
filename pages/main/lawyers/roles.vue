<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <div class="flex flex-row gap-2 w-full p-3 justify-between border-b items-center">
      <div class="flex flex-row items-center gap-2">
        <NuxtLink to="/main/lawyers">
          <Button variant="ghost" size="icon"><ArrowLeft class="size-5" /></Button>
        </NuxtLink>
        <h1 class="text-xl font-bold ibm-plex-serif">Roles</h1>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="flex flex-col gap-2 p-3 border-b">
        <p class="text-sm text-muted-foreground max-w-3xl">
          A title decides what somebody may do here. Change it once and it applies
          to everyone who holds it — you do not set permissions person by person.
          Anything you have changed for an individual stays with them.
        </p>
      </div>

      <!-- Being honest about the bypass rather than showing switches that do
           nothing. An owner or an admin holds everything by virtue of
           administering the workspace; the grid below cannot restrict them, and
           pretending otherwise is how a screen comes to disagree with the
           database. -->
      <div class="flex flex-row items-start gap-3 m-3 p-3 rounded-lg border bg-muted/40">
        <Shield class="size-4 mt-0.5 text-muted-foreground shrink-0" />
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium">Owners and admins are not restricted by a title</span>
          <span class="text-sm text-muted-foreground">
            They administer the workspace — billing, membership, firm settings — and
            hold every permission regardless of the role they are given. To limit
            what someone may do, make them a member first.
          </span>
        </div>
      </div>

      <div v-if="loading" class="flex flex-col gap-3 p-3">
        <div v-for="i in 3" :key="i" class="h-40 rounded-lg border bg-muted animate-pulse" />
      </div>

      <div v-else-if="loadError" class="flex flex-col items-center justify-center gap-3 p-3 py-12 m-3 border rounded-lg bg-muted/30">
        <h3 class="text-lg font-semibold">Could not load the firm's roles</h3>
        <p class="text-sm text-muted-foreground text-center">{{ loadError }}</p>
        <Button variant="outline" @click="load">Try again</Button>
      </div>

      <div v-else class="flex flex-col gap-3 p-3">
        <div v-for="role in roles" :key="role.id" class="flex flex-col rounded-lg border bg-card">
          <div class="flex flex-row items-start justify-between gap-3 p-3 border-b">
            <div class="flex flex-col gap-1 min-w-0">
              <div class="flex flex-row items-center gap-2">
                <SharedLawyersMemberRoleBadge :role="role.key" :label="role.label" />
                <span class="text-xs text-muted-foreground">
                  {{ role.members }} {{ role.members === 1 ? 'member' : 'members' }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground">{{ role.description }}</p>
            </div>
          </div>

          <div class="flex flex-col divide-y">
            <div
                v-for="capability in CAPABILITIES"
                :key="capability.key"
                class="flex flex-row items-center justify-between gap-3 p-3"
            >
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-medium">{{ capability.label }}</span>
                <span class="text-xs text-muted-foreground">{{ capability.description }}</span>
              </div>

              <!-- A graded capability is a three-way choice, not a switch. Reading
                   a colleague's matter and editing it are different grants, and
                   the underlying model has always been able to say so. -->
              <Select
                  v-if="capability.graded"
                  :model-value="draftFor(role)[capability.key]"
                  :disabled="saving"
                  @update:model-value="(v) => v && stage(role, capability.key, v as string)"
              >
                <SelectTrigger class="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No access</SelectItem>
                  <SelectItem value="view">Can view</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                </SelectContent>
              </Select>
              <Switch
                  v-else
                  :model-value="draftFor(role)[capability.key] === 'edit'"
                  :disabled="saving"
                  @update:model-value="(v) => stage(role, capability.key, v ? 'edit' : 'none')"
              />
            </div>
          </div>

          <div v-if="isDirty(role)" class="flex flex-row items-center justify-between gap-3 p-3 border-t bg-muted/40">
            <span class="text-sm text-muted-foreground">
              Unsaved changes to {{ role.label }}.
            </span>
            <div class="flex flex-row gap-2">
              <Button variant="ghost" size="sm" :disabled="saving" @click="discard(role)">Discard</Button>
              <Button size="sm" :disabled="saving" @click="confirmSave(role)">Save</Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- The blast radius, named, before anything commits. The count comes from
         the server's own preview rather than from the row we happen to be
         showing, so it is the number of people the write will actually touch. -->
    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change what {{ pending?.label }} may do?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="affected === null">Checking who this affects…</template>
            <template v-else-if="affected === 0">
              Nobody holds this title yet, so no one's access changes today. Anyone
              given it later starts from these permissions.
            </template>
            <template v-else>
              This will change access for
              <strong>{{ affected }} {{ affected === 1 ? 'member' : 'members' }}</strong>
              currently assigned to {{ pending?.label }}. It takes effect immediately.
              Permissions set for an individual are not affected.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="saving">Cancel</AlertDialogCancel>
          <AlertDialogAction :disabled="saving || affected === null" @click="save">
            {{ saving ? 'Saving…' : 'Apply' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Shield } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { getOrganisationRoles, updateOrganisationRole, apiErrorMessage } from '~/services/admin'
import { getSignedInUser } from '~/services/auth'
import { CAPABILITIES } from '~/components/shared/Lawyers/members'

definePageMeta({ middleware: 'organisation-admin' })

interface Role {
  id: string
  key: string
  label: string
  description: string
  capabilities: Record<string, string>
  members: number
}

const organisationId = getSignedInUser()?.organisation
const roles = ref<Role[]>([])
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)

// Edits are staged per role and applied on Save. Writing on every toggle would
// re-materialise every holder of the role five times while an admin made up
// their mind about one change.
const drafts = ref<Record<string, Record<string, string>>>({})

const draftFor = (role: Role) => drafts.value[role.id] ?? role.capabilities

function stage(role: Role, key: string, level: string) {
  const current = { ...draftFor(role) }
  current[key] = level
  drafts.value = { ...drafts.value, [role.id]: current }
}

function isDirty(role: Role) {
  const draft = drafts.value[role.id]
  if (!draft) return false
  return CAPABILITIES.some((c) => draft[c.key] !== role.capabilities[c.key])
}

function discard(role: Role) {
  const next = { ...drafts.value }
  delete next[role.id]
  drafts.value = next
}

async function load() {
  if (!organisationId) return
  loading.value = true
  try {
    loadError.value = ''
    const response: any = await getOrganisationRoles(organisationId)
    roles.value = response.roles ?? []
    drafts.value = {}
  } catch (error) {
    console.error('Failed to load roles:', error)
    loadError.value = apiErrorMessage(error, "Failed to load the firm's roles")
  } finally {
    loading.value = false
  }
}

const confirmOpen = ref(false)
const pending = ref<Role | null>(null)
const affected = ref<number | null>(null)

async function confirmSave(role: Role) {
  pending.value = role
  affected.value = null
  confirmOpen.value = true
  if (!organisationId) return
  try {
    // A preview commits nothing; it exists so the sentence above is true rather
    // than an estimate from a list that may be a page old.
    const response: any = await updateOrganisationRole(organisationId, role.id, { preview: true })
    affected.value = response.affectedMembers ?? 0
  } catch (error) {
    console.error(error)
    // Fall back to the count the listing gave us rather than blocking the save
    // behind a number we could not refresh.
    affected.value = role.members
  }
}

async function save() {
  const role = pending.value
  if (!role || !organisationId) return
  saving.value = true
  try {
    const response: any = await updateOrganisationRole(organisationId, role.id, {
      capabilities: draftFor(role),
    })
    toast.success(
        response.affectedMembers
            ? `${role.label} updated — ${response.affectedMembers} ${response.affectedMembers === 1 ? 'member' : 'members'} re-checked`
            : `${role.label} updated`,
    )
    confirmOpen.value = false
    pending.value = null
    await load()
    // Everyone holding this role was re-materialised, so the directory and the
    // caller's own permissions may both be stale.
    useState<number>('lawyersDirectoryRefresh', () => 0).value++
    await usePermissions().fetchPermissions()
  } catch (error) {
    console.error(error)
    toast.error(apiErrorMessage(error, 'Could not update the role'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
