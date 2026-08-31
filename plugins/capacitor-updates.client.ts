import { initializeCapacitorUpdates } from '~/services/capacitor-updates';
import { isDesktop } from '~/utils/isDesktop';

export default defineNuxtPlugin((nuxtApp) => {
  if (isDesktop()) return;

  // Nuxt has mounted the shell and routing is available. Do not wait for API
  // requests: this acknowledgement is the bounded health check for a bundle.
  nuxtApp.hook('app:mounted', () => {
    void initializeCapacitorUpdates().catch((error) => {
      console.error('[capgo] updater initialization failed', error);
    });
  });
});
