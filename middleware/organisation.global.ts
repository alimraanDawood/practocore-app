import Pocketbase from "pocketbase";

const SERVER_URL = "https://www.practocore.com";
// const SERVER_URL = "https://www.practocore.com";


export default defineNuxtRouteMiddleware((to, from) => {
    const pb = new Pocketbase(SERVER_URL);

    if(to.query?.org) { // needs a specific organisation
        if(to.query?.org === pb.authStore.record?.organisation) {
            return;
        } else {
            // try loading the organisation
            return navigateTo(`/org-switch?organisation=${to.query?.org}&next=${to.path}`);
        }
    }
});
