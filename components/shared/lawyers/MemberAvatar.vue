<script setup lang="ts">
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

const props = defineProps<{
  name: string
  email: string
  avatar?: string,
  lawyerId?: string
}>()

const initials = computed(() => {
  return props.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
})

</script>

<template>
  <SharedLawyersLawyerDetails :lawyer-id="lawyerId">
    <button class="flex text-left items-center gap-3 hover:bg-muted p-2 rounded-lg">
      <Avatar class="h-8 w-8">
        <AvatarImage v-if="avatar" :src="avatar" :alt="name" />
        <AvatarFallback class="text-xs font-medium bg-primary/10 text-primary">
          {{ initials }}
        </AvatarFallback>
      </Avatar>
      <div class="flex flex-col min-w-0">
        <span class="text-sm font-medium leading-none truncate">{{ name }}</span>
        <span class="text-xs text-muted-foreground mt-0.5 truncate">{{ email }}</span>
      </div>
    </button>
  </SharedLawyersLawyerDetails>
</template>