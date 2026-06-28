import { pb } from "~/lib/pocketbase";

export default defineNuxtRouteMiddleware((to, from) => {


    if (pb.authStore.isValid && pb.authStore.record?.collectionName === 'Users') {
        return;
    }

    // `/admin/*` is the standalone superuser area, gated by the `superuser`
    // route middleware (a separate `_superusers` session, not the app `Users`
    // login) — it must stay reachable without a normal app session.
    // `/word/*` and `/outlook/*` are the Office add-in routes (rendered inside the
    // Word/Outlook task pane). They own their own auth UX (a sign-in panel that hands
    // off to /auth/login), so the global guard stands down rather than redirecting the
    // pane itself.
    if(to.path === '/' || to.path.startsWith("/auth") || to.path.startsWith('/splash') || to.path.startsWith('/intro') || to.path.startsWith('/billing') || to.path.startsWith('/admin') || to.path.startsWith('/word') || to.path.startsWith('/outlook')) {
        return;
    }

    // In a real app you would probably not redirect every route to `/`
    // however it is important to check `to.path` before redirecting or you
    // might get an infinite redirect loop
    if (to.path !== "/auth") {
        return navigateTo(`/auth/login?next=${to.path}`);
    }
});
