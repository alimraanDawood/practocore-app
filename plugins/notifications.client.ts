import { getNotificationService } from "~/services/notifications";

export default defineNuxtPlugin((nuxtApp) => {
    const { $pb } = nuxtApp;
    const router = useRouter();
    const service = getNotificationService($pb as any);

    // Setup notification handlers
    service.setupHandlers(router);

    // Start background sync
    service.startBackgroundSync();

    // Cleanup on app unmount
    nuxtApp.hook('app:beforeUnmount', () => {
        service.cleanup();
    });

    return {
        provide: {
            notifications: service
        }
    };
});