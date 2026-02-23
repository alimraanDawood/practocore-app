<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col w-full h-full overflow-y-scroll">

        <!-- Back button for mobile -->
        <div class="flex flex-row items-center gap-3 p-3 border-b lg:hidden">
          <Button variant="outline" size="icon-sm" @click="$router.back()">
            <ArrowLeft class="size-5" />
          </Button>
          <span class="text-lg font-semibold">Organisation Profile</span>

          <SharedDarkModeSwitch class="ml-auto" />
        </div>

        <div class="flex flex-col gap-6 p-4 lg:p-6">
          <PageComponentsOrganisationProfile />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowLeft, Headset, Mail, MessageCircle, ExternalLink, Copy } from "lucide-vue-next";
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'no-mobile-nav'
})

const platform = computed(() => {
  if (typeof window === 'undefined') return 'web';
  if ('__TAURI_INTERNALS__' in window) return 'desktop (Tauri)';
  if (/android/i.test(navigator.userAgent)) return 'android';
  if (/iphone|ipad/i.test(navigator.userAgent)) return 'ios';
  return 'web';
});

const shortUA = computed(() => {
  if (typeof window === 'undefined') return '';
  return navigator.userAgent;
});

const copyDebugInfo = async () => {
  const info = [
    `App version: 1.0.0`,
    `Platform: ${platform.value}`,
    `User agent: ${shortUA.value}`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(info);
    toast.success('Debug info copied to clipboard');
  } catch {
    toast.error('Could not copy to clipboard');
  }
};
</script>

