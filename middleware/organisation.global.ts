import { pb } from "~/lib/pocketbase";

export default defineNuxtRouteMiddleware((to, from) => {

    if(to.query?.org) { // needs a specific organisation
        if(to.query?.org === pb.authStore.record?.organisation) {
            return;
        } else {
            // try loading the organisation
            return navigateTo(`/org-switch?organisation=${to.query?.org}&next=${to.path}`);
        }
    }
});
