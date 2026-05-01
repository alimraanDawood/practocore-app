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

const onTrialPaymentComplete = async (phone: string) => {
  // Navigate to 'creating' — the heavy async work runs there
  // Pass the mobile money phone via store so StepCreating can use it
  store.mobileMoneyPhone = phone
  await navigateTo('/auth/register/creating')
}

const footerLabel = computed(() =>
  isSubmitting.value ? 'Processing…' : 'Continue to Payment'
)

provide('stepCanProceed', canProceed)
provide('stepFooterLabel', footerLabel)
provide('stepHandleNext', handleNext)
</script>
