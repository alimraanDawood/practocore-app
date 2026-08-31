<script setup lang="ts">
import { getMemberHistory, apiErrorMessage } from '~/services/admin'
import { CAPABILITY_LABELS } from '~/components/shared/Lawyers/members'
import dayjs from 'dayjs'

// What has been done to this person's membership, and by whom.
//
// A permission with no answer to "who decided this, and when" is the thing a
// firm cannot explain to anybody outside the room. Everything here comes from
// MembershipAuditEvents, which the server writes in the same transaction as the
// change itself.
const props = defineProps<{ lawyerId: string }>()

const entries = ref<any[]>([])
const loading = ref(true)
const error = ref('')

const ACTION_LABELS: Record<string, string> = {
  invited: 'Invited',
  accepted: 'Joined the firm',
  role_changed: 'Title changed',
  authority_changed: 'Authority changed',
  permissions_changed: 'Permissions changed',
  removed: 'Removed from the firm',
  left: 'Left the firm',
  ownership_transferred: 'Ownership transferred',
  role_bundle_changed: 'Role redefined',
}

// A one-line summary of what actually moved. The snapshots hold the whole
// membership either side, so the difference is computed here rather than stored
// — a stored diff would reference a role bundle that may since have been edited.
function summarise(entry: any): string {
  const before = entry.before ?? {}
  const after = entry.after ?? {}
  if (entry.action === 'removed' || entry.action === 'left') {
    const swept = before.swept
    if (!swept) return ''
    const parts = [
      swept.matters ? `${swept.matters} matter${swept.matters === 1 ? '' : 's'}` : '',
      swept.deadlines ? `${swept.deadlines} deadline${swept.deadlines === 1 ? '' : 's'}` : '',
      swept.engagements ? `${swept.engagements} engagement${swept.engagements === 1 ? '' : 's'}` : '',
      swept.vaults ? `${swept.vaults} vault${swept.vaults === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return parts.length ? `Unassigned from ${parts.join(', ')}` : 'No assignments to clear'
  }
  if (entry.action === 'role_changed' && before.role !== after.role) {
    return `${before.role || 'none'} → ${after.role || 'none'}`
  }
  if (entry.action === 'authority_changed' && before.authority !== after.authority) {
    return `${before.authority || 'member'} → ${after.authority || 'member'}`
  }
  if (entry.action === 'permissions_changed') {
    const held = new Set<string>(before.permissions ?? [])
    const now = new Set<string>(after.permissions ?? [])
    const granted = [...now].filter((p) => !held.has(p))
    const removed = [...held].filter((p) => !now.has(p))
    const parts = []
    if (granted.length) parts.push(`granted ${granted.map(pretty).join(', ')}`)
    if (removed.length) parts.push(`withdrew ${removed.map(pretty).join(', ')}`)
    return parts.join(' · ')
  }
  return ''
}

// The five legacy slugs read badly in a sentence. Map them onto the capability
// labels the rest of the surface uses.
const SLUG_TO_CAPABILITY: Record<string, string> = {
  canViewExternalMatters: 'matters.all',
  canCreateMatters: 'matters.create',
  canDeleteMatters: 'matters.delete',
  canCreateApplications: 'applications.create',
  canManageTemplates: 'templates.firm',
}
function pretty(slug: string) {
  return CAPABILITY_LABELS[SLUG_TO_CAPABILITY[slug]] ?? slug
}

async function load() {
  loading.value = true
  try {
    error.value = ''
    const response: any = await getMemberHistory(props.lawyerId)
    entries.value = response.history ?? []
  } catch (e) {
    console.error(e)
    error.value = apiErrorMessage(e, 'Could not load this member’s history')
  } finally {
    loading.value = false
  }
}

watch(() => props.lawyerId, load, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="loading" class="flex flex-col gap-2">
      <div v-for="i in 3" :key="i" class="h-12 rounded-lg bg-muted animate-pulse" />
    </div>

    <p v-else-if="error" class="text-sm text-muted-foreground">{{ error }}</p>

    <p v-else-if="!entries.length" class="text-sm text-muted-foreground">
      Nothing recorded yet. Changes to this person's title, authority and
      permissions appear here with who made them.
    </p>

    <div v-else class="flex flex-col divide-y border rounded-lg">
      <div v-for="entry in entries" :key="entry.id" class="flex flex-col gap-0.5 p-3">
        <span class="text-sm font-medium">{{ ACTION_LABELS[entry.action] ?? entry.action }}</span>
        <span v-if="summarise(entry)" class="text-sm text-muted-foreground">{{ summarise(entry) }}</span>
        <span class="text-xs text-muted-foreground">
          {{ entry.actor || 'System' }} · {{ dayjs(entry.created).format('D MMM YYYY, HH:mm') }}
        </span>
      </div>
    </div>
  </div>
</template>
