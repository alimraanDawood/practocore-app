<script lang="ts" setup>
import { Toaster as Sonner, type ToasterProps } from 'vue-sonner'

const props = defineProps<ToasterProps>()
</script>

<template>
  <Sonner
    class="toaster group"
    v-bind="props"
    :rich-colors="true"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',

      '--success-bg': 'var(--popover)',
      '--success-text': 'var(--color-accent-success)',
      '--success-border': 'var(--border)',

      '--warning-bg': 'var(--popover)',
      '--warning-text': 'var(--color-accent-warning)',
      '--warning-border': 'var(--border)',

      '--error-bg': 'var(--popover)',
      '--error-text': 'var(--color-accent-error)',
      '--error-border': 'var(--border)',

    }"
  />
</template>
