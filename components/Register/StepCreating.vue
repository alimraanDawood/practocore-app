<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <!-- Creating account / saving -->
    <div v-if="phase === 'working'" class="my-auto flex flex-col items-center gap-4">
      <div class="flex items-center justify-center size-16 rounded-full bg-muted">
        <Loader2 class="size-8 text-primary animate-spin" />
      </div>
      <div class="flex flex-col items-center gap-1 text-center">
        <p class="font-medium">{{ statusMessage }}</p>
        <p class="text-sm text-muted-foreground">This takes just a moment.</p>
      </div>
    </div>

    <!-- Awaiting mobile-money payment confirmation -->
    <div v-else-if="phase === 'awaiting-payment'" class="my-auto flex flex-col items-center gap-5">
      <template v-if="pollingStatus === 'waiting'">
        <div class="relative">
          <div class="size-16 rounded-full border-4 border-muted animate-pulse" />
          <Loader2 class="size-8 text-primary animate-spin absolute top-4 left-4" />
        </div>
        <div class="flex flex-col items-center gap-1 text-center">
          <p class="font-semibold text-lg">Waiting for Payment Confirmation</p>
          <p class="text-sm text-muted-foreground max-w-sm">
            A payment prompt has been sent to your phone. Enter your PIN to complete the transaction.
          </p>
        </div>
        <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
          <Loader2 class="size-3 animate-spin" />
          <span>Checking payment status…</span>
        </div>
      </template>

      <template v-else-if="pollingStatus === 'success'">
        <div class="size-16 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
          <CheckCircle2 class="size-8 text-green-600" />
        </div>
        <div class="flex flex-col items-center gap-1 text-center">
          <p class="font-semibold text-lg">Payment Successful!</p>
          <p class="text-sm text-muted-foreground">Your subscription is now active. Taking you in…</p>
        </div>
      </template>

      <template v-else-if="pollingStatus === 'timeout'">
        <div class="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 grid place-items-center">
          <Clock class="size-8 text-amber-600" />
        </div>
        <div class="flex flex-col items-center gap-1 text-center">
          <p class="font-semibold text-lg">Payment Still Processing</p>
          <p class="text-sm text-muted-foreground max-w-sm">
            We haven't received a confirmation yet. Your dashboard will update automatically once the payment is confirmed.
          </p>
        </div>
        <Button class="w-full max-w-xs" @click="proceedAfterSignup">Continue to dashboard</Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader2, CheckCircle2, Clock } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useRegisterStore } from '~/stores/register'
import {
  individualSignUp,
  organisationSignUp,
  getUserPreferences,
  updateUserPreferencesById,
  updateUser,
  acceptInvite,
  getSignedInUser,
} from '~/services/auth'
import { pb } from '~/lib/pocketbase'
import { clearAccountAccessCache } from '~/composables/useAccountAccess'
import { getCardSession, getSubscriptionStatus } from '~/services/subscriptions/index.ts'

const store = useRegisterStore()
const statusMessage = ref('Creating your account…')

// 'working' = creating/saving spinner; 'awaiting-payment' = mobile-money polling
const phase = ref<'working' | 'awaiting-payment'>('working')
const pollingStatus = ref<'waiting' | 'success' | 'timeout'>('waiting')
let pollingInterval: ReturnType<typeof setInterval> | null = null
let pollingTimeout: ReturnType<typeof setTimeout> | null = null

// No footer nav on this step — layout hides it automatically (showFooterNav = false for 'creating')
onMounted(() => {
  store.stepCanProceed = false
  store.stepFooterLabel = ''
  store.stepNextAction = async () => {}
})

onMounted(async () => {
  try {
    if (store.persona === 'JOIN') {
      await runJoinFlow()
    } else {
      await runSignupFlow()
    }
  } catch (e) {
    console.error(e)
    toast.error('Something went wrong. Please try again.')
    // Send back to the appropriate prior step
    const fallback = store.persona === 'JOIN' ? '/auth/register/reminders' : '/auth/register/trial-payment'
    await navigateTo(fallback)
  }
})

onUnmounted(() => {
  stopPolling()
})

// ─── JOIN flow ────────────────────────────────────────────────────────────────

const runJoinFlow = async () => {
  statusMessage.value = 'Saving your preferences…'
  await saveReminderPrefs()

  statusMessage.value = 'Joining workspace…'
  if (getSignedInUser()) {
    try {
      await acceptInvite(store.inviteToken)
    } catch (e: any) {
      toast.error('Account created but failed to join workspace. Please contact your administrator.')
    }
    // Joined an org — invalidate the cached access result so the guard sees the new
    // membership instead of bouncing back to registration.
    clearAccountAccessCache()
    await navigateTo('/main')
  } else {
    await runSignupFlow()
  }
}

// ─── SOLO / ORG signup flow ───────────────────────────────────────────────────

const runSignupFlow = async () => {
  const userId = store.isGoogleAuth ? store.googleUserId : store.createdUserId
  const phone = store.mobileMoneyPhone ?? ''
  const paymentMethod = store.trialPaymentMethod ?? 'MOBILE_MONEY'

  statusMessage.value = 'Setting up your workspace…'

  const payload: any = {
    type: store.persona === 'ORG' ? 'ORG' : 'IND',
    user: {
      id: userId,
      mobileMoneyNumber: phone || undefined,
      paymentMethod,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  }

  let signupResult: any

  if (store.persona === 'ORG') {
    payload.organisation = {
      firmName: store.orgDetails.firmName,
      firmEmailDomain: '',
      contact: {
        fullName: store.firmContact.fullName,
        emailAddress: store.firmContact.emailAddress,
        phoneNumber: store.firmContact.phoneNumber,
      },
    }
    signupResult = await organisationSignUp(payload)
  } else {
    if(store.inviteToken) {
      signupResult = await individualSignUp(payload, store.inviteToken);
    } else {
      signupResult = await individualSignUp(payload);
    }
  }

  // Refresh auth so pb.authStore.record reflects the org field
  await pb.collection('Users').authRefresh()

  // The workspace was just created — drop the cached "no workspace" access result so
  // the account.global guard re-resolves it on /main instead of bouncing us back into
  // registration on a stale empty result.
  clearAccountAccessCache()

  statusMessage.value = 'Saving your preferences…'
  await saveReminderPrefs()

  const subscriptionId = signupResult?.subscription?.id

  // FREE_TRIAL: the backend waived the upfront fee and provisioned the term
  // already active. No payment to collect or wait for — go straight in,
  // regardless of the chosen payment method.
  if (subscriptionId && signupResult?.subscription?.active) {
    await proceedAfterSignup()
    return
  }

  // CARD: hand off to the MarzPay-hosted card page.
  if (paymentMethod === 'CARD' && subscriptionId) {
    await redirectToCardPayment(subscriptionId)
    return
  }

  // MOBILE_MONEY: the trial subscription is created inactive — access is granted
  // only once the mobile-money charge is confirmed via the provider webhook. Wait
  // for that confirmation here rather than dropping the user on an inactive
  // dashboard with no feedback.
  if (paymentMethod === 'MOBILE_MONEY' && subscriptionId) {
    startPaymentPolling(subscriptionId)
    return
  }

  // MANUAL (invoice / bank transfer): confirmed later by our team — let the user
  // straight in; their dashboard activates when the payment is recorded.
  if (paymentMethod === 'MANUAL') {
    toast.info('Payment pending', {
      description: 'Our team will confirm your payment shortly. You can start using PractoCore now.',
    })
  }

  await proceedAfterSignup()
}

const proceedAfterSignup = async () => {
  stopPolling()
  if (store.persona === 'ORG') {
    await navigateTo('/auth/register/invite-team')
  } else {
    await navigateTo('/main')
  }
}

// ─── Mobile-money payment confirmation polling ────────────────────────────────

const startPaymentPolling = (subscriptionId: string) => {
  phase.value = 'awaiting-payment'
  pollingStatus.value = 'waiting'

  pollingInterval = setInterval(async () => {
    try {
      const status = await getSubscriptionStatus(subscriptionId)
      if (status.paymentStatus === 'complete' && status.active) {
        pollingStatus.value = 'success'
        stopPolling()
        toast.success('Payment confirmed!', { description: 'Your subscription is now active.' })
        setTimeout(() => { proceedAfterSignup() }, 1800)
      }
    } catch (e) {
      console.warn('Payment polling error:', e)
    }
  }, 5000)

  // After 90s without confirmation, let the user proceed — the webhook will still
  // activate their subscription in the background.
  pollingTimeout = setTimeout(() => {
    if (pollingStatus.value === 'waiting') {
      pollingStatus.value = 'timeout'
      stopPolling()
    }
  }, 90000)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
  if (pollingTimeout) {
    clearTimeout(pollingTimeout)
    pollingTimeout = null
  }
}

const redirectToCardPayment = async (subscriptionId: string) => {
  localStorage.setItem('pendingCardSubscriptionId', subscriptionId)
  statusMessage.value = 'Preparing secure payment…'

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const session = await getCardSession(subscriptionId)
      if (session.redirect_url) {
        window.location.href = session.redirect_url
        return
      }
    } catch (e) {
      console.warn('Card session poll error:', e)
    }
  }

  // Timed out — fall through to main so the user isn't stuck
  await navigateTo('/main')
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const saveReminderPrefs = async () => {
  try {
    const prefs = await getUserPreferences()
    if (prefs?.id) {
      await updateUserPreferencesById(prefs.id, {
        reminder_time: store.reminderPrefs.time,
        use_email_notifications: store.reminderPrefs.email,
        use_app_notifications: store.reminderPrefs.app,
        use_push_notifications: store.reminderPrefs.push,
        use_sms_notifications: store.reminderPrefs.sms,
      })
      if (store.reminderPrefs.sms && store.reminderPrefs.phone) {
        await updateUser({ phone: `+256${store.reminderPrefs.phone}` })
      }
    }
  } catch (e) {
    console.error('Preferences save failed (non-fatal):', e)
  }
}
</script>
