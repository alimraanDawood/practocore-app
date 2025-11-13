import { initializePushNotifications } from '~/services/push-notifications';

export default defineNuxtPlugin(async () => {
  // Initialize push notifications after app is ready
  // Only initialize if user is authenticated
  const { $pb } = useNuxtApp();

  if ($pb.authStore.isValid) {
    // Small delay to ensure app is fully loaded
    setTimeout(async () => {
      await initializePushNotifications();
    }, 1000);
  }

  // Listen for auth changes to register/unregister
  $pb.authStore.onChange(() => {
    if ($pb.authStore.isValid) {
      initializePushNotifications();
    }
  });
});
