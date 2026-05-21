<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">

      <!-- Code entry state -->
      <template v-if="store.joinInfoState === 'enter-code'">
        <div class="flex flex-col items-center gap-2 text-center max-w-md">
          <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
            <Mail class="size-8 text-primary" />
          </div>
          <h2 class="text-2xl font-bold ibm-plex-serif">Join your firm's workspace</h2>
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
            @keydown.enter="canProceed && handleNext()"
          >
            <PinInputGroup>
              <template :key="i" v-for="i in 8">
                <PinInputSlot :index="i - 1" />
              </template>
            </PinInputGroup>
          </PinInput>
          <p v-if="joinError" class="text-sm text-destructive text-center">{{ joinError }}</p>
          <p class="text-xs text-muted-foreground text-center">Uppercase letters and numbers only</p>
        </div>
      </template>

      <!-- Confirmed state -->
      <template v-else-if="store.joinInfoState === 'confirmed' && store.inviteDetails">
        <div class="flex flex-col items-center gap-2 text-center max-w-md">
          <div class="flex items-center justify-center size-16 rounded-full bg-green-500/10">
            <CheckCircle2 class="size-8 text-green-500" />
          </div>
          <h2 class="text-2xl font-bold ibm-plex-serif">Invitation verified</h2>
          <p class="text-muted-foreground text-sm">
            Create your account to join the workspace below.
          </p>
        </div>

        <div class="flex flex-col gap-3 w-full max-w-sm p-4 rounded-lg border bg-card">
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">Firm</span>
            <span class="font-semibold">{{ store.inviteDetails.orgName }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">Invited by</span>
            <span class="text-sm">{{ store.inviteDetails.inviterName }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground uppercase tracking-wide">For email</span>
            <span class="text-sm font-mono">{{ store.inviteDetails.email }}</span>
          </div>
        </div>

        <button
          class="text-xs text-muted-foreground underline underline-offset-2"
          @click="resetCode"
        >
          Use a different code
        </button>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { Mail, CheckCircle2 } from 'lucide-vue-next'
import { useRegisterStore } from '~/stores/register'
import { getOrganisationInviteReference } from '~/services/auth'
import { SERVER_URL } from '~/lib/pocketbase'

const store = useRegisterStore()
const route = useRoute()

// Local invite code array (UI only — joined string stored on store)
const inviteCode = ref<string[]>(Array(8).fill(''))
const joinError = ref('')
const isVerifying = ref(false)

// On mount: handle ?ref= query param (direct invite link from email)
onMounted(async () => {
  const ref = route.query.ref as string | undefined
  if (!ref) return
  try {
    const details = await getOrganisationInviteReference(ref)
    if (details?.invite) {
      store.persona = 'JOIN'
      store.inviteToken = ref
      store.inviteDetails = {
        orgName: details.invite.organisation.name,
        inviterName: details.invite.invitedBy.name,
        email: details.invite.email,
      }
      store.joinInfoState = 'confirmed'
    }
  } catch {
    // Fall through — user can enter code manually
  }
})

const onInviteCodeChange = (val: string[]) => {
  inviteCode.value = val.map(c => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
}

const inviteCodeString = computed(() => inviteCode.value.join(''))

const resetCode = () => {
  store.joinInfoState = 'enter-code'
  store.inviteDetails = null
  store.inviteToken = ''
  inviteCode.value = Array(8).fill('')
  joinError.value = ''
}

const verifyCode = async () => {
  if (inviteCodeString.value.length !== 8 || isVerifying.value) return
  isVerifying.value = true
  joinError.value = ''
  try {
    const res = await fetch(`${SERVER_URL}/api/invitations/get-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCodeString.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message ?? 'Invalid code. Please check and try again.')
    store.inviteToken = data.token

    const details = await getOrganisationInviteReference(data.token)
    if (!details?.invite) throw new Error('Could not load invitation details.')
    store.inviteDetails = {
      orgName: details.invite.organisation.name,
      inviterName: details.invite.invitedBy.name,
      email: details.invite.email,
    }
    store.joinInfoState = 'confirmed'
  } catch (e: any) {
    joinError.value = e.message ?? 'Invalid code. Please check and try again.'
  } finally {
    isVerifying.value = false
  }
}

const handleNext = async () => {
  console.log("Checking code")
  if (store.joinInfoState === 'confirmed') {
    await store.advance('join-info')
  } else {
    await verifyCode()
  }
}

const canProceed = computed(() => {
  if (store.joinInfoState === 'confirmed') return true
  return inviteCodeString.value.length === 8 && !isVerifying.value
})

const footerLabel = computed(() => {
  if (store.joinInfoState === 'confirmed') return 'Create my account'
  return isVerifying.value ? 'Verifying…' : 'Verify code'
})

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
watch(footerLabel, v => { store.stepFooterLabel = v }, { immediate: true })
onMounted(() => {
  store.stepNextAction = handleNext
})
</script>
