<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="p-0">
      <div class="flex flex-row p-3 border-b">
        <span class="font-semibold ibm-plex-serif text-lg">Join an organisation</span>
      </div>

      <div class="p-6">
        <!-- Joined: offer the switch, don't take it -->
        <div v-if="joined" class="flex flex-col items-center gap-6 w-full">
          <div class="flex flex-col items-center gap-2 text-center max-w-md">
            <div class="flex items-center justify-center size-16 rounded-full bg-green-500/10">
              <CheckCircle2 class="size-8 text-green-500" />
            </div>
            <h2 class="text-2xl font-bold ibm-plex-serif">You've joined {{ joined.name }}</h2>
            <p class="text-muted-foreground text-sm">
              You're still working in your current workspace. Switch to {{ joined.name }} now, or
              stay where you are and switch later from this menu.
            </p>
          </div>
        </div>

        <SharedJoinOrganisation
          v-else
          ref="joinForm"
          confirmed-hint="Confirm the details below to join this workspace."
          @verified="onVerified"
          @reset="verified = false"
        />

        <p v-if="joinError" class="text-sm text-destructive text-center mt-4">{{ joinError }}</p>
      </div>

      <div class="flex flex-row justify-end p-3 border-t gap-2">
        <template v-if="joined">
          <Button size="sm" variant="outline" @click="close">Stay here</Button>
          <Button size="sm" :disabled="switching" @click="switchToJoined">
            <Loader2 v-if="switching" class="size-4 animate-spin" />
            <span v-else>Switch to {{ joined.name }}</span>
          </Button>
        </template>
        <template v-else>
          <DialogClose as-child>
            <Button size="sm" variant="outline">Cancel</Button>
          </DialogClose>
          <Button size="sm" :disabled="!canSubmit" @click="submit">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            <span v-else>{{ verified ? 'Join workspace' : 'Verify code' }}</span>
          </Button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * In-app "join an organisation".
 *
 * Before this, joining a firm was only possible by clicking a link in an email —
 * there was no entry point inside the product at all.
 *
 * The verification half is SharedJoinOrganisation, the same component the
 * register flow uses, so the two entry points cannot drift.
 */
import { CheckCircle2, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { DialogClose } from '@/components/ui/dialog'
import { joinOrganisation, switchOrganisation } from '~/services/organisations'
import { clearAccountAccessCache } from '~/composables/useAccountAccess'

const open = ref(false)
const joinForm = ref<any>(null)
const verified = ref(false)
const busy = ref(false)
const switching = ref(false)
const joinError = ref('')
const joined = ref<{ id: string; name: string } | null>(null)

const canSubmit = computed(() => !busy.value && (verified.value || !!joinForm.value?.canProceed))

const onVerified = () => {
  verified.value = true
  joinError.value = ''
}

const submit = async () => {
  if (busy.value) return
  joinError.value = ''

  // Two-stage on purpose: verify first so the user sees which firm and which
  // invited address they are about to commit to, then join.
  if (!verified.value) {
    await joinForm.value?.verify()
    return
  }

  busy.value = true
  try {
    // The typed CODE, not the resolved token: /api/organisations/join composes
    // resolve and accept server-side so this path and the emailed-link path
    // cannot drift on the email match or the seat check.
    const result = await joinOrganisation(joinForm.value?.enteredCode ?? '')
    joined.value = result.organisation
    clearAccountAccessCache()
    toast.success(result.message ?? 'Invitation accepted')
  } catch (e: any) {
    joinError.value = e?.message ?? 'We could not join that organisation. Please try again.'
  } finally {
    busy.value = false
  }
}

/**
 * Switching is offered, never taken. Joining a second firm must not evict the
 * user from the one they are working in — the server leaves
 * `Users.organisation` alone for exactly this reason.
 */
const switchToJoined = async () => {
  if (!joined.value || switching.value) return
  switching.value = true
  try {
    await switchOrganisation(joined.value.id)
    clearAccountAccessCache()
    // Full reload so permissions, plan and account access re-init under the new
    // workspace rather than running on cached state from the old one.
    window.location.reload()
  } catch (e) {
    console.error(e)
    toast.error('We could not switch workspaces. You can switch from this menu at any time.')
    switching.value = false
  }
}

const close = () => {
  open.value = false
  // Reset so reopening starts clean rather than on a stale success screen.
  joined.value = null
  verified.value = false
  joinError.value = ''
}
</script>
