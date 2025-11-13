import { pb } from "~/lib/pocketbase";

export default defineNuxtRouteMiddleware((to, from) => {


    if (pb.authStore.isValid && pb.authStore.record?.collectionName === 'Users') {
        return;
    }

    if(to.path.startsWith("/auth") || to.path.startsWith('/splash')) {
        return;
    }

    // In a real app you would probably not redirect every route to `/`
    // however it is important to check `to.path` before redirecting or you
    // might get an infinite redirect loop
    if (to.path !== "/auth") {
        return navigateTo(`/auth/login?next=${to.path}`);
    }
});
