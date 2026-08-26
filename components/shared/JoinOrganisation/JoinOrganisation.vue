<template>
  <div class="flex flex-col items-center gap-6 w-full">

    <!-- Code entry -->
    <template v-if="state === 'enter-code'">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <Mail class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">{{ heading }}</h2>
        <p class="text-muted-foreground text-sm">
          Check your email for an 8-character invite code from your firm administrator.
        </p>
      </div>

      <div class="flex flex-col items-center gap-3 w-full max-w-sm">
        <label class="text-sm font-medium self-start">Invite code</label>
        <PinInput
          :model-value="inviteCode"
          @update:model-value="onInviteCodeChange"
          type="text"
          otp
          placeholder="·"
          class="justify-center"
          @keydown.enter="canProceed && verify()"
        >
          <PinInputGroup>
            <template :key="i" v-for="i in 8">
              <PinInputSlot :index="i - 1" />
              <template v-if="separator && i === 4">
                <PinInputSeparator />
              </template>
            </template>
          </PinInputGroup>
        </PinInput>
        <p v-if="error" class="text-sm text-destructive text-center">{{ error }}</p>
        <p class="text-xs text-muted-foreground text-center">Uppercase letters and numbers only</p>
      </div>
    </template>

    <!-- Verified -->
    <template v-else-if="state === 'confirmed' && details">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-green-500/10">
          <CheckCircle2 class="size-8 text-green-500" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">Invitation verified</h2>
        <p class="text-muted-foreground text-sm">{{ confirmedHint }}</p>
      </div>

      <div class="flex flex-col gap-3 w-full max-w-sm p-4 rounded-lg border bg-card">
        <div class="flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground uppercase tracking-wide">Firm</span>
          <span class="font-semibold">{{ details.orgName }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground uppercase tracking-wide">Invited by</span>
          <span class="text-sm">{{ details.inviterName }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs text-muted-foreground uppercase tracking-wide">For email</span>
          <span class="text-sm font-mono">{{ details.email }}</span>
        </div>
      </div>

      <!-- The invited address is shown above on purpose: the backend enforces a
           strict email match on accept, so someone signed in as a personal
           address needs to see which account this invitation belongs to. -->
      <button
        class="text-xs text-muted-foreground underline underline-offset-2"
        @click="reset"
      >
        Use a different code
      </button>
    </template>

  </div>
</template>

<script setup lang="ts">
/**
 * The invite-code entry and verification UI, in one place.
 *
 * This markup and its verify logic previously existed three times over —
 * components/Register/StepJoinInfo.vue, pages/onboarding2/index.vue, and
 * implicitly in pages/auth/invitation.vue — with the copies already drifting
 * (only one of them rendered the mid-code separator). All three now render this.
 *
 * It verifies and nothing else. What happens with a verified invitation differs
 * by caller: the register flow carries the token forward into account creation,
 * while the in-app dialog accepts it immediately. So this emits `verified` and
 * lets the caller decide.
 */
import { Mail, CheckCircle2 } from 'lucide-vue-next'
import { verifyInvitation } from '~/services/auth'
import { resolveInviteCode } from '~/services/organisations'
import type { InviteDetails } from './types'

const props = withDefaults(defineProps<{
  /** A `?ref=` token from an emailed link, verified automatically on mount. */
  autoRef?: string
  /** Render a separator halfway through the code, as the onboarding flow does. */
  separator?: boolean
  heading?: string
  confirmedHint?: string
}>(), {
  autoRef: '',
  separator: false,
  heading: "Join your firm's workspace",
  confirmedHint: 'Create your account to join the workspace below.',
})

const emit = defineEmits<{
  (e: 'verified', payload: { token: string; details: InviteDetails }): void
  (e: 'reset'): void
}>()

const state = ref<'enter-code' | 'confirmed'>('enter-code')
const inviteCode = ref<string[]>(Array(8).fill(''))
const details = ref<InviteDetails | null>(null)
const token = ref('')
const error = ref('')
const isVerifying = ref(false)

const inviteCodeString = computed(() => inviteCode.value.join(''))

const canProceed = computed(() =>
  state.value === 'confirmed' || (inviteCodeString.value.length === 8 && !isVerifying.value),
)

const onInviteCodeChange = (val: string[]) => {
  // Uppercase and strip: the codes are generated from an uppercase alphabet, so
  // a lowercase entry is the same code rather than a wrong one.
  inviteCode.value = val.map(c => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
}

const toDetails = (invite: any): InviteDetails => ({
  orgName: invite?.organisation?.name ?? '',
  // The inviter may have left the firm since. The backend degrades to an empty
  // name rather than withholding a valid invitation, so this does too.
  inviterName: invite?.invitedBy?.name ?? '',
  email: invite?.email ?? '',
})

const confirm = (verifiedToken: string, invite: any) => {
  token.value = verifiedToken
  details.value = toDetails(invite)
  state.value = 'confirmed'
  emit('verified', { token: verifiedToken, details: details.value })
}

const reset = () => {
  state.value = 'enter-code'
  details.value = null
  token.value = ''
  inviteCode.value = Array(8).fill('')
  error.value = ''
  emit('reset')
}

/** Resolve the typed code to a token, then load the invitation for the card. */
const verify = async () => {
  if (state.value === 'confirmed' || inviteCodeString.value.length !== 8 || isVerifying.value) return
  isVerifying.value = true
  error.value = ''
  try {
    const resolvedToken = await resolveInviteCode(inviteCodeString.value)
    const result = await verifyInvitation(resolvedToken)
    if (!result?.invite) throw new Error('Could not load invitation details.')
    confirm(resolvedToken, result.invite)
  } catch (e: any) {
    error.value = e?.message ?? 'Invalid code. Please check and try again.'
  } finally {
    isVerifying.value = false
  }
}

// A `?ref=` link from the invitation email skips code entry entirely. A failure
// here is silent by design — the user can still type the code by hand.
onMounted(async () => {
  if (!props.autoRef) return
  try {
    const result = await verifyInvitation(props.autoRef)
    if (result?.invite) confirm(props.autoRef, result.invite)
  } catch {
    // fall through to manual entry
  }
})

// enteredCode is exposed alongside token because the two entry points need
// different things: the register flow carries the TOKEN forward into account
// creation, while the in-app dialog posts the CODE to /api/organisations/join
// and lets the server resolve and accept in one call.
defineExpose({ verify, reset, state, canProceed, isVerifying, details, token, enteredCode: inviteCodeString })
</script>
