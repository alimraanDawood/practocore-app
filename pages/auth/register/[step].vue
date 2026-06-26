<template>
  <component :is="stepComponent" v-if="stepComponent" />
  <div
      v-else
      class="flex flex-1 items-center justify-center text-muted-foreground text-sm p-6"
  >
    Unknown step "{{ currentStep }}".
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { RegisterStep } from '@/stores/register'

definePageMeta({ layout: 'register' })

const route = useRoute()
const currentStep = computed(() => route.params.step as RegisterStep)

// Lazy-loaded step components — only the active step's bundle is fetched
const stepComponents: Record<RegisterStep, ReturnType<typeof defineAsyncComponent>> = {
  'persona':         defineAsyncComponent(() => import('@/components/Register/StepPersona.vue')),
  'join-info':       defineAsyncComponent(() => import('@/components/Register/StepJoinInfo.vue')),
  'org-details':     defineAsyncComponent(() => import('@/components/Register/StepOrgDetails.vue')),
  'firm-contact':    defineAsyncComponent(() => import('@/components/Register/StepFirmContact.vue')),
  'invite-team':     defineAsyncComponent(() => import('@/components/Register/StepInviteTeam.vue')),
  'account-create':  defineAsyncComponent(() => import('@/components/Register/StepAccountCreate.vue')),
  'verify-otp':      defineAsyncComponent(() => import('@/components/Register/StepOtp.vue')),
  'reminders':       defineAsyncComponent(() => import('@/components/Register/StepReminders.vue')),
  'trial-payment':   defineAsyncComponent(() => import('@/components/Register/StepTrialPayment.vue')),
  'creating':        defineAsyncComponent(() => import('@/components/Register/StepCreating.vue')),
}

const stepComponent = computed(() => stepComponents[currentStep.value] ?? null)
</script>