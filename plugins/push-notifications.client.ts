import { initializePushNotifications } from '~/services/push-notifications';

function isFullySetUp(pb: any): boolean {
  // Only register for push notifications once the user has completed onboarding
  // (i.e. they have an organisation assigned). During account creation the
  // record exists but organisation is still null/empty.
  return pb.authStore.isValid && !!pb.authStore.record?.organisation;
}

export default defineNuxtPlugin(async () => {
  const { $pb } = useNuxtApp();

  if (isFullySetUp($pb)) {
    setTimeout(async () => {
      await initializePushNotifications();
    }, 1000);
  }

  // Re-check on every auth state change (includes authRefresh after onboarding completes)
  $pb.authStore.onChange(() => {
    if (isFullySetUp($pb)) {
      initializePushNotifications();
    }
  });
});
