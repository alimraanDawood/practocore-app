<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <MailCheck class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">Verify your email</h2>
        <p class="text-muted-foreground text-sm">
          We sent a 5-digit code to
          <span class="font-medium text-foreground">{{ email || 'your email' }}</span>.
          Enter it below to continue.
        </p>
      </div>

      <!-- Issuing the code -->
      <div v-if="issuing" class="flex flex-col items-center gap-3 py-6 text-muted-foreground">
        <Loader2 class="size-6 animate-spin" />
        <span class="text-sm">Sending your code…</span>
      </div>

      <template v-else>
        <PinInput
            id="register-otp"
            v-model="pin"
            placeholder="○"
            class="flex gap-2 items-center"
            otp
            type="number"
        >
          <PinInputGroup>
            <PinInputSlot v-for="(id, index) in 5" :key="id" :index="index" />
          </PinInputGroup>
        </PinInput>

        <div class="flex flex-row items-center gap-2 text-sm">
          <span class="text-muted-foreground">Didn't get the code?</span>
          <button
              type="button"
              class="font-semibold text-primary disabled:opacity-50"
              :disabled="resending"
              @click="handleResend"
          >
            <span v-if="resending">Sending…</span>
            <span v-else>Resend code</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MailCheck, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  PinInput,
  PinInputGroup,
  PinInputSlot,
} from '@/components/ui/pin-input'
import { useRegisterStore } from '~/stores/register'
import { sendOTP, resendOTP, verifyOTP } from '~/services/auth'
import { pb } from '~/lib/pocketbase'

const store = useRegisterStore()

const pin = ref<string[]>([])
const otpId = ref('')
const issuing = ref(true)
const resending = ref(false)
const verifying = ref(false)

// The just-created account is authenticated, so its record is the source of
// truth for the userId. Fall back to the ids captured during the flow.
const userId = computed(
    () => pb.authStore.record?.id || store.createdUserId || store.googleUserId || '',
)
const email = computed(
    () => (pb.authStore.record?.email as string) || store.firmContact.emailAddress || '',
)

const code = computed(() => pin.value.join(''))

// Where to go once verified: continue the registration flow if we're mid-flow,
// otherwise (e.g. a returning unverified user routed here by the gate) drop them
// into the app.
const proceed = async () => {
  const next = store.nextStepPath('verify-otp')
  if (next && (store.createdUserId || store.isGoogleAuth)) {
    await navigateTo(next)
  } else {
    await navigateTo('/main')
  }
}

const handleVerify = async () => {
  if (verifying.value) return
  if (code.value.length !== 5) {
    toast.error('Enter the 5-digit code from your email.')
    return
  }

  verifying.value = true
  store.stepCanProceed = false
  try {
    const response = await verifyOTP(otpId.value, userId.value, code.value)
    if (!response.ok) throw new Error(response.statusText)

    // Refresh the auth record so `verified` flips to true for the gate.
    await pb.collection('Users').authRefresh()

    toast.success('Email verified!')
    await proceed()
  } catch (e) {
    console.error(e)
    toast.error('Verification failed. Check the code and try again.')
    pin.value = []
    store.stepCanProceed = true
  } finally {
    verifying.value = false
  }
}

const handleResend = async () => {
  if (!userId.value) return
  resending.value = true
  try {
    // Prefer resend (keeps the same record) once we have one; otherwise issue
    // a fresh code.
    const response = otpId.value
        ? await resendOTP(otpId.value, userId.value)
        : await sendOTP(userId.value)
    if (!response.ok) throw new Error(response.statusText)

    if (!otpId.value) {
      const result = await response.json()
      otpId.value = result?.otpId ?? ''
    }
    toast.success('A new code is on its way.')
  } catch (e) {
    console.error(e)
    toast.error('Could not resend the code. Please try again.')
  } finally {
    resending.value = false
  }
}

const issueCode = async () => {
  if (!userId.value) {
    toast.error('Something went wrong. Please sign in again.')
    return
  }
  issuing.value = true
  try {
    const response = await sendOTP(userId.value)
    if (!response.ok) throw new Error(response.statusText)
    const result = await response.json()

    // Already verified (e.g. Google sign-in) — nothing to do, move on.
    if (result?.verified) {
      await proceed()
      return
    }
    otpId.value = result?.otpId ?? ''
  } catch (e) {
    console.error(e)
    toast.error('Could not send your verification code. Try resending.')
  } finally {
    issuing.value = false
  }
}

// Auto-submit once five digits are entered.
watch(code, (val) => {
  store.stepCanProceed = val.length === 5
  if (val.length === 5) handleVerify()
})

onMounted(() => {
  store.stepCanProceed = false
  store.stepFooterLabel = 'Verify'
  store.stepNextAction = handleVerify

  // Skip entirely if the account is already verified.
  if (pb.authStore.record?.verified) {
    proceed()
    return
  }
  issueCode()
})
</script>
