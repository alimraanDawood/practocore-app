import { pb } from '~/lib/pocketbase';

export default defineNuxtPlugin(() => {
    return {
        provide: {
            pb
        }
    };
});