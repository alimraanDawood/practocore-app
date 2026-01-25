<template>
  <div>
    <!-- Trigger Button -->
    <Button :variant="buttonVariant" :size="buttonSize" type="button" @click="open = true">
      <Clock class="mr-2 size-4" />
      {{ formattedTime }}
    </Button>

    <!-- Desktop: Dialog -->
    <Dialog v-if="!isMobile" v-model:open="open">
      <DialogContent class="sm:max-w-[340px] p-0">
        <DialogHeader class="p-4 pb-0">
          <DialogTitle>Select Time</DialogTitle>
          <DialogDescription>Choose when you want to receive reminders</DialogDescription>
        </DialogHeader>

        <SharedTimePickerContent
          :hours="hours"
          :minutes="minutes"
          @update:hours="hours = $event"
          @update:minutes="minutes = $event"
        />

        <div class="flex flex-row gap-2 p-4 pt-0">
          <DialogClose as-child>
            <Button variant="outline" class="flex-1">Cancel</Button>
          </DialogClose>
          <Button class="flex-1" @click="confirmSelection">Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Mobile: Drawer -->
    <Drawer v-else v-model:open="open">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select Time</DrawerTitle>
          <DrawerDescription>Choose when you want to receive reminders</DrawerDescription>
        </DrawerHeader>

        <SharedTimePickerContent
          :hours="hours"
          :minutes="minutes"
          @update:hours="hours = $event"
          @update:minutes="minutes = $event"
        />

        <DrawerFooter>
          <Button @click="confirmSelection">Confirm</Button>
          <DrawerClose as-child>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const props = withDefaults(defineProps<{
  modelValue?: string // "HH:mm" format
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
}>(), {
  buttonVariant: 'outline',
  buttonSize: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 640)

// Parse initial value or default to 09:00
const parseTime = (time: string | undefined) => {
  if (!time) return { h: 9, m: 0 }
  const [h, m] = time.split(':').map(Number)
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m }
}

const initialTime = parseTime(props.modelValue)
const hours = ref(initialTime.h)
const minutes = ref(initialTime.m)

const formattedTime = computed(() => {
  const h = hours.value
  const m = minutes.value
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`
})

const triggerHaptic = async () => {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch (e) {
    // Silently fail
  }
}

const confirmSelection = () => {
  const value = `${hours.value.toString().padStart(2, '0')}:${minutes.value.toString().padStart(2, '0')}`
  emit('update:modelValue', value)
  triggerHaptic()
  open.value = false
}

// Watch for external value changes
watch(() => props.modelValue, (newVal) => {
  const parsed = parseTime(newVal)
  hours.value = parsed.h
  minutes.value = parsed.m
})
</script>