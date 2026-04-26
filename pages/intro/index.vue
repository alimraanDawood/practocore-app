<script setup lang="ts">
definePageMeta({
  layout: 'blank'
})
</script>

<template>
  <div class="flex flex-col md:items-center w-full h-dvh relative overflow-hidden">
    <div class="flex flex-row justify-between items-center p-3 border-b pc-enter">
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

    <div class="flex flex-col text-foreground justify-center min-h-[65vh] z-10 p-5 gap-5 w-full md:max-w-lg md:px-8 md:gap-7">
      <span
        class="text-3xl md:text-4xl font-semibold ibm-plex-serif text-foreground pc-enter"
        style="animation-delay: 80ms"
      >
        Never miss a litigation deadline
      </span>

      <span
        class="md:text-base md:leading-relaxed pc-enter"
        style="animation-delay: 220ms"
      >
        Calculates court deadlines from Uganda's civil procedure rules and sends reminders before they're due. Your whole team sees every active matter, in real time.
      </span>

      <div class="flex flex-col gap-2 md:gap-3">
        <NuxtLink
          class="w-full pc-enter"
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
          class="w-full pc-enter"
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

    <!-- Counter-clockwise stars, bottom-right -->
    <img
      src="@/assets/img/onboarding/Star%201%20-%20dark.svg"
      class="fixed hidden dark:block sm:w-[50vw] bottom-0 translate-y-[35%] right-0 translate-x-[25%] pc-star-reverse"
      aria-hidden="true"
    />
    <img
      src="@/assets/img/onboarding/Star%201.svg"
      class="fixed dark:hidden sm:w-[50vw] bottom-0 translate-y-[35%] right-0 translate-x-[25%] pc-star-reverse"
      aria-hidden="true"
    />
    <!-- Clockwise elements -->
    <img
      src="@/assets/img/onboarding/Star%202.svg"
      class="fixed sm:w-[50vw] w-[85%] bottom-0 translate-y-[-5%] right-0 translate-x-[55%] pc-star-forward"
      aria-hidden="true"
    />
    <img
      src="@/assets/img/onboarding/Group%204.svg"
      class="fixed sm:w-[50vw] bottom-0 translate-y-[50%] left-0 translate-x-[-50%] pc-star-forward"
      aria-hidden="true"
    />
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

@keyframes pc-spin-cw {
  to { transform: rotate(360deg); }
}

@keyframes pc-spin-ccw {
  to { transform: rotate(-360deg); }
}

@keyframes pc-fade-half {
  from { opacity: 0; }
  to   { opacity: 0.5; }
}

/* Content entrance: fade up, stagger via inline animation-delay */
.pc-enter {
  animation: pc-enter-up 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Stars: spin + fade in after content settles */
.pc-star-reverse {
  animation:
    pc-spin-ccw 20s linear infinite,
    pc-fade-half 900ms cubic-bezier(0.25, 1, 0.5, 1) 500ms both;
}

.pc-star-forward {
  animation:
    pc-spin-cw 20s linear infinite,
    pc-fade-half 900ms cubic-bezier(0.25, 1, 0.5, 1) 620ms both;
}

@media (prefers-reduced-motion: reduce) {
  .pc-enter {
    animation: none;
  }
  .pc-star-reverse,
  .pc-star-forward {
    animation: none;
    opacity: 0.5;
  }
}
</style>
