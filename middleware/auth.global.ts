import Pocketbase from "pocketbase";

const SERVER_URL = "https://www.practocore.com";
// const SERVER_URL = "https://www.practocore.com";


export default defineNuxtRouteMiddleware((to, from) => {
    const pb = new Pocketbase(SERVER_URL);


    if (pb.authStore.isValid) {
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
