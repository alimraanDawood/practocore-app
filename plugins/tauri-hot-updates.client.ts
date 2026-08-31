import { initializeTauriHotUpdates } from '~/services/tauri-hot-updates';

export default defineNuxtPlugin((nuxtApp) => {
  // The ready acknowledgement is the rollback boundary. Do not tie it to API
  // authentication or network readiness: an offline boot can still be healthy.
  nuxtApp.hook('app:mounted', () => void initializeTauriHotUpdates());
});
