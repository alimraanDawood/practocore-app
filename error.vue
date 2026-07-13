<script setup lang="ts">
import type { NuxtError } from '#app';
import { Home, ArrowLeft, RotateCw, LifeBuoy } from 'lucide-vue-next';

// Nuxt renders this component (outside NuxtPage) for any unhandled error, including
// the automatic 404 when no route matches. `error.statusCode` distinguishes them.
const props = defineProps<{ error: NuxtError }>();

const router = useRouter();

const isNotFound = computed(() => props.error?.statusCode === 404);

const title = computed(() => (isNotFound.value ? 'Page not found' : 'Something went wrong'));

const message = computed(() => {
  if (isNotFound.value) {
    return "The page you're looking for doesn't exist, may have moved, or the link is broken.";
  }
  return props.error?.message || 'An unexpected error occurred. Please try again in a moment.';
});

// clearError wipes Nuxt's error state; pass a redirect to also navigate.
function goHome() {
  clearError({ redirect: '/main/' });
}

function goBack() {
  // Fall back to the app home if there's no history to go back to.
  if (window.history.length > 1) {
    router.back();
    clearError();
  } else {
    goHome();
  }
}

function reload() {
  clearError({ redirect: useRoute().fullPath });
}
</script>

<template>
  <div class="flex flex-col w-screen h-dvh divide-x bg-background text-foreground">
    <div class="flex flex-col w-full h-full col-span-1">
      <div class="flex flex-col w-full h-full gap-5 items-center justify-center">
        <div class="flex flex-col w-[95vw] items-center justify-center max-w-xl p-3 h-full">
          <div class="flex flex-col w-full max-w-md gap-6 text-center">
            <div class="flex flex-col items-center gap-3">
              <img alt="PractoCore" src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-10" />


              <p class="ibm-plex-serif text-5xl font-semibold tracking-tight">
                {{ error?.statusCode || 'Error' }}
              </p>
              <h1 class="text-2xl font-semibold tracking-tight ibm-plex-serif">
                {{ title }}
              </h1>
              <p class="text-balance text-sm text-muted-foreground">
                {{ message }}
              </p>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:justify-center mx-auto">
              <Button class="gap-2 bg-tertiary hover:bg-tertiary/90" @click="goHome">
                <Home class="size-4" /> Back to app
              </Button>
              <Button variant="outline" class="gap-2" @click="goBack">
                <ArrowLeft class="size-4" /> Go back
              </Button>
              <Button v-if="!isNotFound" variant="outline" class="gap-2" @click="reload">
                <RotateCw class="size-4" /> Try again
              </Button>
            </div>

            <div class="text-sm text-muted-foreground">
              Still stuck?
              <a href="mailto:support@practocore.com"
                 class="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground">
                <LifeBuoy class="size-3.5" /> Contact support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
