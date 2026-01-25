<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "."
import { Primitive } from "reka-ui"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { cn } from "@/lib/utils"
import { buttonVariants } from "."

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"]
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
})

const triggerHaptic = async () => {
  if (!Capacitor.isNativePlatform()) return

  const effectiveVariant = props.variant ?? "default"
  if (effectiveVariant === "default" || effectiveVariant === "destructive") {
    const style = effectiveVariant === "destructive" ? ImpactStyle.Heavy : ImpactStyle.Light
    try {
      await Haptics.impact({ style })
    } catch (e) {
      console.warn("Haptics failed:", e)
    }
  }
}
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    @click="triggerHaptic"
  >
    <slot />
  </Primitive>
</template>
