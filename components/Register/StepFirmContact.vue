<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <Phone class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">Primary contact details</h2>
        <p class="text-muted-foreground text-sm">
          This person will manage the firm's account and receive important notifications.
        </p>
      </div>

      <div class="flex flex-col gap-4 w-full max-w-sm">
        <p class="text-xs text-muted-foreground text-center -mb-1">
          Pre-filled from your account — change if needed.
        </p>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Full name</label>
          <Input
            v-model="store.firmContact.fullName"
            type="text"
            placeholder="Amina Nakato"
            class="w-full"
            autocomplete="name"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Email address</label>
          <Input
            v-model="store.firmContact.emailAddress"
            type="email"
            placeholder="amina@nakatolaw.co.ug"
            class="w-full"
            autocomplete="email"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">
            Phone number
            <span class="text-muted-foreground font-normal">(optional)</span>
          </label>
          <UgandaPhoneInput
            v-model="store.firmContact.phoneNumber"
            @keydown.enter="canProceed && handleNext()"
          />
          <p class="text-xs text-muted-foreground">For account verification and critical notifications</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Phone } from 'lucide-vue-next'
import { useRegisterStore } from '~/stores/register'

const store = useRegisterStore()

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const canProceed = computed(() =>
  !!store.firmContact.fullName.trim() &&
  emailRegex.test(store.firmContact.emailAddress)
)

const handleNext = async () => {
  if (!canProceed.value) return
  await store.advance('firm-contact')
}

provide('stepCanProceed', canProceed)
provide('stepFooterLabel', ref('Continue'))
provide('stepHandleNext', handleNext)
</script>
