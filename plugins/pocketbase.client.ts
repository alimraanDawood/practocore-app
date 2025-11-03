import PocketBase from 'pocketbase';

export default defineNuxtPlugin(() => {
    const config = useRuntimeConfig();
    const pb = new PocketBase('http://127.0.0.1:8090');

    // Enable auto cancellation for duplicate requests
    pb.autoCancellation(false);

    return {
        provide: {
            pb
        }
    };
});