<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto w-full max-w-sm mx-auto">
      <TrialPayment
        ref="trialPaymentRef"
        :acc-type="store.persona === 'ORG' ? 'ORG' : 'IND'"
        @complete="onTrialPaymentComplete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useRegisterStore } from '~/stores/register'
import {
  individualSignUp,
  organisationSignUp,
  getUserPreferences,
  updateUserPreferencesById,
  updateUser,
} from '~/services/auth'
import { pb } from '~/lib/pocketbase'
import { createMatter } from '~/services/matters'
import TrialPayment from '~/components/auth/RegisterScreens/TrialPayment.vue'

const store = useRegisterStore()
const trialPaymentRef = ref<InstanceType<typeof TrialPayment>>()

const isSubmitting = computed(() => trialPaymentRef.value?.isSubmitting ?? false)
const canProceed = computed(() => !isSubmitting.value)

const handleNext = async () => {
  await trialPaymentRef.value?.triggerSubmit()
}

const onTrialPaymentComplete = async (payload: { phone?: string; paymentMethod: 'MOBILE_MONEY' | 'CARD' | 'MANUAL' }) => {
  store.mobileMoneyPhone = payload.phone ?? ''
  store.trialPaymentMethod = payload.paymentMethod
  await navigateTo('/auth/register/creating')
}

const footerLabel = computed(() =>
  isSubmitting.value ? 'Processing…' : 'Continue to Payment'
)

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
watch(footerLabel, v => { store.stepFooterLabel = v }, { immediate: true })
onMounted(() => {
  store.stepNextAction = handleNext
})
</script>
