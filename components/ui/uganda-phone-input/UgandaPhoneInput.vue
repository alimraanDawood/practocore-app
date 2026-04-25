<template>
  <InputGroup class="overflow-hidden p-0">
    <InputGroupAddon class="border-r px-2 bg-muted h-full">
      <InputGroupText class="text-muted-foreground">+256</InputGroupText>
    </InputGroupAddon>
    <InputGroupInput
      placeholder="712345678"
      maxlength="9"
      inputmode="numeric"
      v-bind="$attrs"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </InputGroup>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>
