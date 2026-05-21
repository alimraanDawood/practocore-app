<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <Bell class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">How should we remind you?</h2>
        <p class="text-muted-foreground text-sm">
          PractoCore sends deadline reminders 30, 14, 7, 3, and 1 day before each deadline.
          Choose when and how you want them.
        </p>
      </div>

      <div class="flex flex-col gap-3 w-full max-w-sm">
        <!-- Daily reminder time -->
        <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card">
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-0.5">
              <p class="text-sm font-medium">Daily reminder time</p>
              <p class="text-xs text-muted-foreground">When you'd like to receive your morning summary</p>
            </div>
            <Input
              type="time"
              v-model="store.reminderPrefs.time"
              class="w-28 text-sm"
            />
          </div>
        </div>

        <!-- Notification channels -->
        <div class="flex flex-col gap-1 p-4 rounded-lg border bg-card">
          <p class="text-sm font-medium mb-2">Notification channels</p>

          <div class="flex items-center justify-between py-2">
            <div class="flex flex-col gap-0.5">
              <p class="text-sm">Email</p>
              <p class="text-xs text-muted-foreground">Reminders sent to your inbox</p>
            </div>
            <Switch
              :model-value="store.reminderPrefs.email"
              @update:model-value="v => store.reminderPrefs.email = v"
            />
          </div>

          <Separator />

          <div class="flex items-center justify-between py-2">
            <div class="flex flex-col gap-0.5">
              <p class="text-sm">In-app</p>
              <p class="text-xs text-muted-foreground">Alerts inside PractoCore</p>
            </div>
            <Switch
              :model-value="store.reminderPrefs.app"
              @update:model-value="v => store.reminderPrefs.app = v"
            />
          </div>

          <Separator />

          <div class="flex items-center justify-between py-2">
            <div class="flex flex-col gap-0.5">
              <p class="text-sm">Push notifications</p>
              <p class="text-xs text-muted-foreground">Alerts on your device</p>
            </div>
            <Switch
              :model-value="store.reminderPrefs.push"
              @update:model-value="v => store.reminderPrefs.push = v"
            />
          </div>

          <Separator />

          <div class="flex flex-col gap-2 py-2">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5">
                <p class="text-sm">SMS</p>
                <p class="text-xs text-muted-foreground">Text messages to your phone</p>
              </div>
              <Switch
                :model-value="store.reminderPrefs.sms"
                @update:model-value="v => store.reminderPrefs.sms = v"
              />
            </div>
            <div v-if="store.reminderPrefs.sms" class="flex flex-col gap-1">
              <UgandaPhoneInput v-model="store.reminderPrefs.phone" />
              <p class="text-xs text-muted-foreground">Uganda number — 9 digits after +256</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell } from 'lucide-vue-next'
import { useRegisterStore } from '~/stores/register'

const store = useRegisterStore()

const canProceed = computed(() =>
  !store.reminderPrefs.sms || /^7[0-9]{8}$/.test(store.reminderPrefs.phone)
)

const handleNext = async () => {
  if (!canProceed.value) return
  await store.advance('reminders')
}

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
onMounted(() => {
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = handleNext
})
</script>
