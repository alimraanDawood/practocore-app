<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-4">
      <div class="flex items-center justify-center size-16 rounded-full bg-muted">
        <Loader2 class="size-8 text-primary animate-spin" />
      </div>
      <div class="flex flex-col items-center gap-1 text-center">
        <p class="font-medium">{{ statusMessage }}</p>
        <p class="text-sm text-muted-foreground">This takes just a moment.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useRegisterStore } from '~/stores/register'
import {
  individualSignUp,
  organisationSignUp,
  getUserPreferences,
  updateUserPreferencesById,
  updateUser,
  acceptInvite,
} from '~/services/auth'
import { pb } from '~/lib/pocketbase'
import { createMatter } from '~/services/matters'
import { getCardSession } from '~/services/subscriptions/index.ts'

const store = useRegisterStore()
const statusMessage = ref('Creating your account…')

// No footer nav on this step — layout hides it automatically (showFooterNav = false for 'creating')
onMounted(() => {
  store.stepCanProceed = false
  store.stepFooterLabel = ''
  store.stepNextAction = async () => {}
})
onUnmounted(() => {
  store.stepCanProceed = true
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = null
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

// ─── JOIN flow ────────────────────────────────────────────────────────────────

const runJoinFlow = async () => {
  statusMessage.value = 'Saving your preferences…'
  await saveReminderPrefs()

  statusMessage.value = 'Joining workspace…'
  try {
    await acceptInvite(store.inviteToken)
  } catch (e: any) {
    toast.error('Account created but failed to join workspace. Please contact your administrator.')
  }
  await navigateTo('/main')
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
    signupResult = await individualSignUp(payload)
  }

  // Refresh auth so pb.authStore.record reflects the org field
  await pb.collection('Users').authRefresh()

  statusMessage.value = 'Saving your preferences…'
  await saveReminderPrefs()

  statusMessage.value = 'Saving your matter…'
  await saveMatter()

  if (paymentMethod === 'CARD') {
    const subscriptionId = signupResult?.subscription?.id
    if (subscriptionId) {
      await redirectToCardPayment(subscriptionId)
      return
    }
  }

  if (store.persona === 'ORG') {
    await navigateTo('/auth/register/invite-team')
  } else {
    await navigateTo('/main')
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

const saveMatter = async () => {
  if (!store.calculatorResult?.templateId) return
  try {
    await createMatter({
      name: store.calculatorResult.title,
      caseNumber: '',
      personal: true,
      templateId: store.calculatorResult.templateId,
      date: store.calculatorResult.triggerDate,
      fieldValues: store.calculatorResult.fieldValues,
    })
  } catch (e) {
    console.error('Matter save failed (non-fatal):', e)
  }
}
</script>
