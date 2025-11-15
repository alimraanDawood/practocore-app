<template>
  <div class="flex flex-row items-center">
    <!-- Display up to 3 avatars -->
    <Avatar
      v-for="(member, index) in visibleMembers"
      :key="member.id"
      :class="[
        'ring-2 ring-background',
        index > 0 ? '-ml-2' : ''
      ]"
      :style="{ zIndex: visibleMembers.length - index }"
      class="size-7"
    >
      <AvatarImage :src="member?.avatar" :alt="member?.name" />
      <AvatarFallback class="text-xs bg-primary text-primary-foreground">
        {{ getInitials(member?.name) }}
      </AvatarFallback>
    </Avatar>

    <!-- Show +N indicator for remaining members -->
    <div
      v-if="remainingCount > 0"
      class="flex items-center justify-center size-7 -ml-2 rounded-full bg-muted ring-2 ring-background text-xs font-semibold"
      :style="{ zIndex: 0 }"
    >
      +{{ remainingCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  members: any[]
  maxVisible?: number
}>()

const maxVisible = computed(() => props.maxVisible ?? 3)

const visibleMembers = computed(() => {
  return props.members?.slice(0, maxVisible.value) ?? []
})

const remainingCount = computed(() => {
  const total = props.members?.length ?? 0
  return Math.max(0, total - maxVisible.value)
})

const getInitials = (name: string) => {
  if (!name) return '??'

  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0]?.at(0)?.toUpperCase() ?? '') + (parts[1]?.at(0)?.toUpperCase() ?? '')
  }
  return parts[0]?.slice(0, 2)?.toUpperCase() ?? '??'
}
</script>
