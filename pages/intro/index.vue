<script setup lang="ts">
import type { StarFieldSource } from '~/components/shared/StarField.vue'

definePageMeta({
  layout: 'blank'
})

/**
 * Cycled through the star field.
 *
 * The crane is a flat colour illustration, so it needs `silhouette` — its
 * white cheek and pale crest would otherwise sample as background and punch
 * holes through the bird. Crown and head only: the full standing crane is
 * nearly twice as tall as it is wide, so the band's height caps it at about
 * half this size. The whole-bird original is kept alongside as `crane.png`.
 *
 * Vector rather than raster because the crown is a fan of thin spikes, and at
 * this grid pitch a rasterised spike blurs into the gaps between its
 * neighbours; the SVG is rasterised at draw size, so they stay separate.
 */
const shapes: StarFieldSource[] = [
  { kind: 'text', value: 'AI' },
  // Already a solid black shape on transparency, so darkness alone reads it
  // correctly and it does not need the silhouette flood fill.
  { kind: 'image', src: '/onboarding/uganda.svg' },
  { kind: 'image', src: '/onboarding/crane-head.svg', silhouette: true },
  { kind: 'image', src: '/onboarding/gavel.webp' }
]
</script>

<template>
  <div class="flex flex-col items-center w-full h-dvh relative overflow-hidden safe-area-shell">
    <SharedStarField :sequence="shapes" :hold="2" :morph="1.4" />

    <div class="relative z-20 w-full bg-background flex flex-row justify-between items-center p-3 border-b pc-enter">
      <div class="flex items-center gap-2">
        <img
          src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png"
          alt="PractoCore"
          class="h-8 w-auto"
        />
        <span class="text-lg font-semibold ibm-plex-serif">PractoCore</span>
      </div>

      <SharedDarkModeSwitch />
    </div>

    <div class="flex flex-col items-center text-center text-foreground mt-auto z-10 p-5 pb-10 gap-5 w-full max-w-lg md:px-8 md:pb-16 md:gap-7">
      <span
        class="text-3xl md:text-4xl font-semibold ibm-plex-serif text-foreground text-balance pc-enter"
        style="animation-delay: 80ms"
      >
        Run your caseload with an AI that knows Ugandan law
      </span>

      <span
        class="text-pretty md:text-base md:leading-relaxed pc-enter"
        style="animation-delay: 220ms"
      >
        Case management, document drafting, and legal research grounded in Ugandan statutes and case law. Court deadlines computed and tracked for the whole firm.
      </span>

      <div class="flex flex-row gap-2 md:gap-3 w-full">
        <NuxtLink
          class="flex-1 basis-0 min-w-0 pc-enter"
          to="/auth/register"
          style="animation-delay: 360ms"
        >
          <Button
            size="lg"
            class="w-full transition-transform duration-[130ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.97]"
          >
            Create Account
          </Button>
        </NuxtLink>

        <NuxtLink
          class="flex-1 basis-0 min-w-0 pc-enter"
          to="/auth/login"
          style="animation-delay: 450ms"
        >
          <Button
            size="lg"
            variant="secondary"
            class="w-full transition-[transform,opacity] duration-[130ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:opacity-80 active:scale-[0.98]"
          >
            Sign In
          </Button>
        </NuxtLink>
      </div>
    </div>

  </div>
</template>

<style>
@keyframes pc-enter-up {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Content entrance: fade up, stagger via inline animation-delay */
.pc-enter {
  animation: pc-enter-up 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .pc-enter {
    animation: none;
  }
}
</style>
