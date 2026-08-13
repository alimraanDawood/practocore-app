import { initializePushNotifications } from '~/services/push-notifications';

function isFullySetUp(pb: any): boolean {
  // Signed in is the whole bar. This used to additionally require a non-empty
  // `organisation`, meaning to gate on "onboarding finished" — but an empty
  // `organisation` is exactly how a personal account is identified
  // (composables/usePermissions.ts → isIndividual), so that check was
  // indistinguishable from "is in a firm" and solo users never registered for
  // push at all. The mid-signup window it was guarding is covered instead by
  // the authStore.onChange re-check below, which fires again once the record
  // is fully written.
  return pb.authStore.isValid;
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
