<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <div class="flex flex-row gap-2 w-full p-3 justify-between border-b">
      <div class="flex flex-row items-center">
        <SidebarTrigger class="lg:hidden" />
        <h1 class="text-xl font-bold ibm-plex-serif">Team</h1>
      </div>

      <div class="hidden lg:flex flex-row gap-3">
        <NuxtLink to="/main/lawyers/roles">
          <Button variant="outline"><Shield class="size-4 mr-2" /> Roles</Button>
        </NuxtLink>
        <ImportLawyers v-if="canAdminister" @imported="reload">
          <Button variant="outline"><Download class="size-4 mr-2" /> Import</Button>
        </ImportLawyers>
        <InviteUser v-if="canAdminister" v-model:open="inviteOpen" @invited="reload">
          <Button class="w-fit"><Plus /> Add Lawyer</Button>
        </InviteUser>
      </div>
    </div>

    <div class="lg:hidden flex flex-row gap-3 p-3">
      <ImportLawyers v-if="canAdminister" @imported="reload" class="w-full">
        <Button variant="outline" class="w-full flex-1"><Download class="size-4 mr-2" /> Import</Button>
      </ImportLawyers>
      <InviteUser v-if="canAdminister" @invited="reload">
        <Button class="w-full flex-1"><Plus /> Add Lawyer</Button>
      </InviteUser>
    </div>

    <!-- One toolbar. There used to be two, one per tab, with their own copies of
         the search box, the status filter and the result count. -->
    <div class="flex flex-col gap-2 lg:flex-row justify-between w-full p-3 border-b">
      <div class="flex flex-row gap-3 flex-wrap">
        <InputGroup class="min-w-[220px]">
          <InputGroupInput placeholder="Search the team..." v-model="search" />
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupAddon align="inline-end">
            {{ totalItems }} result{{ totalItems === 1 ? '' : 's' }}
          </InputGroupAddon>
        </InputGroup>

        <Select v-model="roleFilter">
          <SelectTrigger class="w-[170px]"><SelectValue placeholder="Any title" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any title</SelectItem>
            <SelectItem v-for="role in roles" :key="role.key" :value="role.key">{{ role.label }}</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="authorityFilter">
          <SelectTrigger class="w-[160px]"><SelectValue placeholder="Any authority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any authority</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="statusFilter">
          <SelectTrigger class="w-[160px]"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Invited</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      <div v-if="loadError" class="flex flex-col items-center justify-center gap-3 p-3 py-12 border rounded-lg bg-muted/30">
        <h3 class="text-lg font-semibold">Could not load the team</h3>
        <p class="text-sm text-muted-foreground text-center">{{ loadError }}</p>
        <Button variant="outline" @click="reload">Try again</Button>
      </div>

      <!-- Bulk bar. Appears only with a selection, which is the only time it has
           anything to say. -->
      <div
          v-if="selected.length"
          class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between p-3 rounded-lg border bg-muted/40"
      >
        <span class="text-sm">
          {{ selected.length }} {{ selected.length === 1 ? 'member' : 'members' }} selected
        </span>
        <div class="flex flex-row gap-2 flex-wrap">
          <Button variant="outline" size="sm" :disabled="bulkBusy" @click="runBulk('promote')">Make admins</Button>
          <Button variant="outline" size="sm" :disabled="bulkBusy" @click="runBulk('demote')">Remove admin access</Button>
          <Button variant="destructive" size="sm" :disabled="bulkBusy" @click="confirmBulkRemove = true">Remove from firm</Button>
          <Button variant="ghost" size="sm" :disabled="bulkBusy" @click="clearSelection">Clear</Button>
        </div>
      </div>

      <!-- ONE context menu for the whole table, not one per row.
           A menu per row is its own dismissable layer, so right-clicking a
           second row opens a SECOND menu with the first still standing. Reka
           re-anchors this single menu at each right-click, so the gesture moves
           it and swaps its contents.

           The aim is cleared by the wrapper's CAPTURE handler (capture runs
           top-down, first) and then set by the row's own target-phase handler.
           Miss a row and the menu offers the surface actions instead of nothing.

           Disabled on a coarse pointer: a long-press there would open the menu
           on top of the browser's own, and the ⋯ button is the touch path. -->
      <ContextMenu v-if="!loadError">
        <ContextMenuTrigger as-child :disabled="coarsePointer">
          <div @contextmenu.capture="ctxTarget = null">
            <SharedLawyersDataTable
                ref="tableRef"
                :columns="columns"
                :data="rows"
                :total="totalItems"
                :loading="loading"
                :page="page"
                :page-size="perPage"
                :selectable="canAdminister && BULK_MEMBER_ACTIONS_ENABLED"
                :is-selectable="isSelectable"
                @update:page="(p) => { page = p; load() }"
                @update:selected="(ids) => selected = ids"
                @row-contextmenu="(row) => ctxTarget = row"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-60">
          <ContextMenuLabel v-if="ctxTarget" class="text-xs text-muted-foreground font-normal truncate">
            {{ ctxTarget.name || ctxTarget.email }}
          </ContextMenuLabel>
          <ContextMenuSeparator v-if="ctxTarget" />
          <SharedActionMenuItems
              :actions="ctxTarget ? actionsFor(ctxTarget) : surfaceActions"
              variant="context"
          />
        </ContextMenuContent>
      </ContextMenu>

      <!-- One set of dialogs for both menus. They used to live inside the row's
           dropdown component, which meant the right-click path would have needed
           a second copy. -->
      <AlertDialog v-model:open="confirmRemoveOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {{ confirmTarget?.name || confirmTarget?.email }} from the firm?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They lose access immediately and are taken off every matter, deadline,
              engagement and vault they are assigned to in this firm. Their work stays
              where it is — only their access to it ends. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="rowBusy">Cancel</AlertDialogCancel>
            <AlertDialogAction :disabled="rowBusy" class="bg-destructive hover:bg-destructive/90" @click="doRemove">
              {{ rowBusy ? 'Removing…' : 'Remove' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="confirmRevokeOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The link and join code sent to {{ confirmTarget?.email }} stop working.
              You can invite them again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="rowBusy">Cancel</AlertDialogCancel>
            <AlertDialogAction :disabled="rowBusy" class="bg-destructive hover:bg-destructive/90" @click="doRevoke">
              {{ rowBusy ? 'Revoking…' : 'Revoke' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="confirmBulkRemove">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {{ selected.length }} {{ selected.length === 1 ? 'member' : 'members' }} from the firm?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each loses access immediately and is taken off every matter, deadline,
              engagement and vault they are assigned to. Members that cannot be
              removed — the owner, the last admin — are skipped and reported rather
              than stopping the rest.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="bulkBusy">Cancel</AlertDialogCancel>
            <AlertDialogAction :disabled="bulkBusy" class="bg-destructive hover:bg-destructive/90" @click="runBulk('remove')">
              {{ bulkBusy ? 'Removing…' : 'Remove' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div v-if="!loadError && totalPages > 1" class="flex flex-row items-center justify-between">
        <span class="text-sm text-muted-foreground">Page {{ page }} of {{ totalPages }}</span>
        <div class="flex flex-row gap-2">
          <Button variant="outline" size="sm" :disabled="page <= 1 || loading" @click="page--; load()">Previous</Button>
          <Button variant="outline" size="sm" :disabled="page >= totalPages || loading" @click="page++; load()">Next</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Search, Download, Shield } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  getUserOrganisationMembers,
  getOrganisationRoles,
  bulkUpdateMembers,
  BULK_MEMBER_ACTIONS_ENABLED,
  apiErrorMessage,
} from '~/services/admin'
import { getSignedInUser } from '~/services/auth'
import InviteUser from '~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue'
import ImportLawyers from '~/components/PageComponents/Organisation/Users/ImportLawyers/ImportLawyers.vue'
import { directoryColumns } from '~/components/shared/Lawyers/columns'
import { directoryActions, directorySurfaceActions } from '~/components/shared/Lawyers/actions'
import { removeMember, revokeInvite } from '~/services/admin'
import { useMediaQuery } from '@vueuse/core'
import type { DirectoryRow } from '~/components/shared/Lawyers/members'

// The surface is administrative, and until now nothing but the sidebar hid it —
// a member who typed the URL got the whole screen. The middleware is the gate;
// the server is the backstop.
definePageMeta({ middleware: 'organisation-admin' })

const { isAdmin } = usePermissions()
const canAdminister = computed(() => isAdmin.value)
const organisationId = getSignedInUser()?.organisation

const rows = ref<DirectoryRow[]>([])
const totalItems = ref(0)
const totalPages = ref(1)
const page = ref(1)
const perPage = ref(25)
const loading = ref(true)
const loadError = ref('')

const search = ref('')
const roleFilter = ref('all')
const authorityFilter = ref('all')
const statusFilter = ref('all')

const roles = ref<{ key: string; label: string; description: string }[]>([])

async function load() {
  loading.value = true
  try {
    loadError.value = ''
    const response: any = await getUserOrganisationMembers({
      page: page.value,
      perPage: perPage.value,
      search: search.value.trim() || undefined,
      role: roleFilter.value === 'all' ? undefined : roleFilter.value,
      authority: authorityFilter.value === 'all' ? undefined : authorityFilter.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      // One list. Pending invitations are rows here, not a second tab with its
      // own search box, status filter, empty state and reload.
      includeInvitations: true,
    })
    rows.value = response.items ?? []
    totalItems.value = response.totalItems ?? 0
    totalPages.value = response.totalPages ?? 1
  } catch (error) {
    console.error('Failed to load the team:', error)
    loadError.value = apiErrorMessage(error, 'Failed to load the team directory')
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  load()
}

// Debounced, because every keystroke is now a request rather than a filter over
// an array the browser already held.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reload, 250)
})
watch([roleFilter, authorityFilter, statusFilter], reload)

// The firm's own titles, for the Title filter. Inviting happens in the Add
// Lawyer dialog, which loads them itself — a form belongs in the dialog that
// frames it, not wedged into a toolbar above the table it is not part of.
async function loadRoles() {
  if (!organisationId) return
  try {
    const response: any = await getOrganisationRoles(organisationId)
    roles.value = response.roles ?? []
  } catch (error) {
    // A failed role list costs the Title filter its options; it must not take
    // the directory down with it.
    console.error('Failed to load roles:', error)
  }
}

// ── Row actions, shared by the ⋯ button and the right-click menu ────────────
//
// A finger long-pressing would open this on top of the browser's own menu, and a
// dismissed-but-not-closed layer leaves the body pointer-events lock behind
// (CLAUDE.md). Touch uses the ⋯ button and the selection bar, as elsewhere.
const coarsePointer = useMediaQuery('(pointer: coarse)')

// What the open menu is aimed at, or null for the table itself.
const ctxTarget = ref<DirectoryRow | null>(null)

// Opens the Add Lawyer dialog from the table's right-click menu, which has no
// trigger of its own.
const inviteOpen = ref(false)

const rowBusy = ref(false)
const confirmTarget = ref<DirectoryRow | null>(null)
const confirmRemoveOpen = ref(false)
const confirmRevokeOpen = ref(false)

// Deferred a tick, deliberately. A menu and a dialog are separate dismissable
// layers: opening the dialog while the menu is still closing leaves the body's
// pointer-events lock in place and the whole app stops taking clicks.
function requestConfirm(kind: 'remove' | 'revoke', row: DirectoryRow) {
  confirmTarget.value = row
  setTimeout(() => {
    if (kind === 'remove') confirmRemoveOpen.value = true
    else confirmRevokeOpen.value = true
  }, 0)
}

const actionsFor = (row: DirectoryRow) =>
    directoryActions(row, {
      canAdminister: canAdminister.value,
      organisationId,
      currentUserId: getSignedInUser()?.id,
      onChanged: reload,
      requestConfirm,
      setBusy: (value) => { rowBusy.value = value },
    })

const surfaceActions = computed(() =>
    directorySurfaceActions({
      canAdminister: canAdminister.value,
      onRefresh: reload,
      // Deferred like the dialogs, for the same layer reason.
      onInvite: () => setTimeout(() => { inviteOpen.value = true }, 0),
      onRoles: () => navigateTo('/main/lawyers/roles'),
    }),
)

async function doRemove() {
  const row = confirmTarget.value
  if (!row || !organisationId) return
  rowBusy.value = true
  try {
    const result: any = await removeMember(row.id, organisationId)
    toast.success(result?.message || 'Member removed')
    reload()
  } catch (error) {
    console.error(error)
    toast.error(apiErrorMessage(error, 'Could not remove member'))
  } finally {
    rowBusy.value = false
    confirmRemoveOpen.value = false
  }
}

async function doRevoke() {
  const row = confirmTarget.value
  if (!row) return
  rowBusy.value = true
  try {
    const result: any = await revokeInvite(row.id)
    toast.success(result?.message || 'Invitation revoked')
    reload()
  } catch (error) {
    console.error(error)
    toast.error(apiErrorMessage(error, 'Could not revoke the invitation'))
  } finally {
    rowBusy.value = false
    confirmRevokeOpen.value = false
  }
}

const columns = computed(() => directoryColumns({ actionsFor }))

// ── Bulk changes ────────────────────────────────────────────────────────────
const tableRef = ref<any>(null)
const selected = ref<string[]>([])
const bulkBusy = ref(false)
const confirmBulkRemove = ref(false)

// Rows the server would refuse anyway. Letting them be selected only produces a
// per-member failure the admin could have been spared, and the bulk result would
// then read "3 of 5" for reasons that were knowable up front.
const isSelectable = (row: DirectoryRow) =>
    row.kind === 'member' && row.authority !== 'owner' && row.id !== getSignedInUser()?.id

function clearSelection() {
  tableRef.value?.clearSelection?.()
  selected.value = []
}

async function runBulk(action: 'promote' | 'demote' | 'remove') {
  if (!organisationId || !selected.value.length) return
  bulkBusy.value = true
  try {
    const response: any = await bulkUpdateMembers(selected.value, organisationId, action)
    // The response is partial by design, so report it that way. A plain success
    // toast over "2 of 3 updated" is how a firm comes to believe somebody was
    // removed who was not.
    if (response?.partial) {
      const failed = (response.results ?? []).filter((r: any) => !r.ok)
      toast.warning(response.message, {
        description: failed.map((r: any) => r.error).filter(Boolean).join(' · '),
      })
    } else {
      toast.success(response?.message || 'Members updated')
    }
    clearSelection()
    reload()
  } catch (error) {
    console.error(error)
    toast.error(apiErrorMessage(error, 'Could not apply the change'))
  } finally {
    bulkBusy.value = false
    confirmBulkRemove.value = false
  }
}

// The member detail sheet changes titles, authority and permissions from inside
// a row. It cannot reach into this page's state, so it bumps a shared counter and
// the directory refetches — the table shows resolved values that only the server
// can compute, so patching a row in place here would guess at them.
const refreshSignal = useState('lawyersDirectoryRefresh', () => 0)
watch(refreshSignal, () => load())

onMounted(() => {
  load()
  loadRoles()
})
</script>
