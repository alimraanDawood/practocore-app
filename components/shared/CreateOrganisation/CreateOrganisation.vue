<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="p-0">
      <div class="flex flex-row p-3 border-b">
        <span class="font-semibold ibm-plex-serif text-lg">
          {{ isUpgrade ? 'Turn your account into a firm' : 'Create an organisation' }}
        </span>
      </div>

      <!-- Done -->
      <div v-if="created" class="p-6 flex flex-col items-center gap-6">
        <div class="flex flex-col items-center gap-2 text-center max-w-md">
          <div class="flex items-center justify-center size-16 rounded-full bg-green-500/10">
            <CheckCircle2 class="size-8 text-green-500" />
          </div>
          <h2 class="text-2xl font-bold ibm-plex-serif">{{ created.organisation.name }} is ready</h2>
          <p class="text-muted-foreground text-sm">
            {{ billingMessage }}
          </p>
        </div>

        <!-- No subscription: say so here rather than letting them discover it at
             the first locked screen. -->
        <div v-if="created.billing === 'none'" class="flex flex-col gap-2 w-full max-w-sm p-4 rounded-lg border border-amber-500/40 bg-amber-500/5">
          <span class="text-sm font-medium">This firm needs a subscription</span>
          <span class="text-xs text-muted-foreground">
            Free trials are once per account, and yours has been used. Set up billing to
            start using {{ created.organisation.name }}.
          </span>
          <NuxtLink to="/main/settings?tab=billing" class="text-xs underline underline-offset-2" @click="close">
            Go to billing
          </NuxtLink>
        </div>

        <!-- What moved. Shown because a migration the user can't see is one they
             can't sanity-check. -->
        <div v-if="movedRows.length" class="flex flex-col gap-2 w-full max-w-sm p-4 rounded-lg border bg-card">
          <span class="text-xs text-muted-foreground uppercase tracking-wide">Moved into {{ created.organisation.name }}</span>
          <div v-for="row in movedRows" :key="row.label" class="flex justify-between text-sm">
            <span>{{ row.label }}</span>
            <span class="font-mono">{{ row.count }}</span>
          </div>
        </div>
      </div>

      <!-- Form -->
      <div v-else class="p-6 flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" for="org-name">Firm name</label>
          <Input id="org-name" v-model="form.name" placeholder="e.g. Kato &amp; Partners Advocates"
                 @keydown.enter="canSubmit && submit()" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" for="org-contact">Contact email</label>
          <Input id="org-contact" v-model="form.contactEmail" type="email"
                 :placeholder="signedInEmail" />
          <p class="text-xs text-muted-foreground">
            Used for billing and firm correspondence. Defaults to your own address.
          </p>
        </div>

        <!-- Only a solo user can upgrade, and the consequence is worth spelling
             out before they commit rather than after. -->
        <div v-if="canUpgrade" class="flex flex-col gap-3 p-3 rounded-lg border bg-muted/40">
          <label class="flex items-start gap-3 cursor-pointer">
            <Checkbox :model-value="isUpgrade" @update:model-value="v => (form.mode = v ? 'upgrade' : 'create')" class="mt-0.5" />
            <span class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">Move my existing work into this firm</span>
              <span class="text-xs text-muted-foreground">
                Your matters, engagements, reminders and assistant conversations move across,
                your subscription comes with you as a single seat, and you start working
                inside the firm. Your saved templates stay private to you. This can't be
                undone from here.
              </span>
            </span>
          </label>
        </div>

        <!-- Deliberately not a promise. Trial eligibility is per account and the
             server decides it — this client cannot know whether the trial has
             already been used, and claiming one that never arrives is worse
             than describing the rule. -->
        <p class="text-xs text-muted-foreground">
          <template v-if="isUpgrade">
            If you already subscribe, your current plan moves across as a single seat and
            keeps the time you've paid for. Otherwise your firm starts on a free trial, if
            you haven't already used one.
          </template>
          <template v-else>
            New firms start on a free trial, if you haven't already used one on this account.
          </template>
        </p>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <div class="flex flex-row justify-end p-3 border-t gap-2">
        <template v-if="created">
          <Button v-if="created.switched" size="sm" @click="reloadIntoWorkspace">Continue</Button>
          <template v-else>
            <Button size="sm" variant="outline" @click="close">Stay here</Button>
            <Button size="sm" :disabled="switching" @click="switchToCreated">
              <Loader2 v-if="switching" class="size-4 animate-spin" />
              <span v-else>Switch to {{ created.organisation.name }}</span>
            </Button>
          </template>
        </template>
        <template v-else>
          <DialogClose as-child>
            <Button size="sm" variant="outline">Cancel</Button>
          </DialogClose>
          <Button size="sm" :disabled="!canSubmit" @click="submit">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            <span v-else>{{ isUpgrade ? 'Create firm and move my work' : 'Create firm' }}</span>
          </Button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * Create an organisation, or upgrade a solo account into one.
 *
 * Both are the same server call with a different mode, and they are presented
 * together because from the user's side they are one decision — "make me a
 * firm" — whose only real question is whether their existing work comes along.
 *
 * The upgrade option only appears for a user with no workspace. Someone already
 * inside a firm has nothing to upgrade, and the server refuses it, so offering
 * the choice would be offering a button that always fails.
 */
import { CheckCircle2, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { DialogClose } from '@/components/ui/dialog'
import { createOrganisation, switchOrganisation, type CreateOrganisationResult } from '~/services/organisations'
import { getSignedInUser } from '~/services/auth'
import { clearAccountAccessCache } from '~/composables/useAccountAccess'
import { beginLocalSwitch } from '~/composables/useWorkspace'

const open = ref(false)
const busy = ref(false)
const switching = ref(false)
const error = ref('')
const created = ref<CreateOrganisationResult | null>(null)

const signedInUser = computed(() => getSignedInUser())
const signedInEmail = computed(() => signedInUser.value?.email ?? '')

// Only a workspace-less account can upgrade. This mirrors the server's own
// precondition rather than guessing at it.
const canUpgrade = computed(() => !signedInUser.value?.organisation)

const form = reactive({
  name: '',
  contactEmail: '',
  mode: 'create' as 'create' | 'upgrade',
})

const isUpgrade = computed(() => form.mode === 'upgrade')
const canSubmit = computed(() => !busy.value && form.name.trim().length > 0)

/** Collection names are internal; these are what a lawyer would call them. */
const movedLabels: Record<string, string> = {
  Matters: 'Matters',
  Applications: 'Applications',
  Engagements: 'Engagements',
  Reminders: 'Reminders',
  AiConversations: 'Assistant conversations',
  Notifications: 'Notifications',
}

/** What the new firm is running on, in the user's terms. */
const billingMessage = computed(() => {
  const c = created.value
  if (!c) return ''
  const where = c.switched
    ? `You're now working in ${c.organisation.name}`
    : `${c.organisation.name} is set up. You're still working in your current workspace — switch whenever you're ready`
  switch (c.billing) {
    case 'transferred':
      return `${where}. Your existing plan came with you as a single seat, and the time you've paid for is unchanged.`
    case 'trial':
      return `${where}, on a free trial.`
    default:
      return `${where}.`
  }
})

const movedRows = computed(() =>
  Object.entries(created.value?.moved ?? {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ label: movedLabels[key] ?? key, count })),
)

const submit = async () => {
  if (busy.value || !canSubmit.value) return
  busy.value = true
  error.value = ''
  try {
    // An upgrade moves the workspace pointer server-side, inside the migration
    // transaction. That is a deliberate switch initiated from this tab, so flag it
    // before the request rather than letting the drift watcher reload the success
    // screen out from under the user before they've read what moved.
    if (form.mode === 'upgrade') beginLocalSwitch()

    created.value = await createOrganisation({
      name: form.name.trim(),
      mode: form.mode,
      contactEmail: form.contactEmail.trim() || undefined,
    })
    clearAccountAccessCache()
  } catch (e: any) {
    error.value = e?.message ?? 'We could not create that organisation. Please try again.'
  } finally {
    busy.value = false
  }
}

/**
 * On an upgrade the server has already moved the workspace pointer, so the
 * session is running against stale context until a reload — permissions, plan
 * and account access all re-init from it.
 */
const reloadIntoWorkspace = () => window.location.reload()

/** On a plain create the switch is offered, never taken. */
const switchToCreated = async () => {
  if (!created.value || switching.value) return
  switching.value = true
  try {
    // See the note in SwitchOrganisations: this tab's own pointer write must not
    // be mistaken for drift.
    beginLocalSwitch()
    await switchOrganisation(created.value.organisation.id)
    clearAccountAccessCache()
    window.location.reload()
  } catch (e) {
    console.error(e)
    toast.error('We could not switch workspaces. You can switch from this menu at any time.')
    switching.value = false
  }
}

const close = () => {
  open.value = false
  created.value = null
  error.value = ''
  form.name = ''
  form.contactEmail = ''
  form.mode = 'create'
}
</script>
