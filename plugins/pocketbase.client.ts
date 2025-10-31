import PocketBase from 'pocketbase';

export default defineNuxtPlugin(() => {
    const config = useRuntimeConfig();
    const pb = new PocketBase('https://www.practocore.com');

    // Enable auto cancellation for duplicate requests
    pb.autoCancellation(false);

    return {
        provide: {
            pb
        }
    };
});