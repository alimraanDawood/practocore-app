import { defineStore } from 'pinia';
import {getOrganisation, getOrganisations, getSignedInUser, refreshUserData, subscribeToUser} from "~/services/auth";
import {checkIfUserIsAdmin} from "~/services/admin";

export const useAuthStore = defineStore('auth', {
    state: () => ({
        pb: getSignedInUser(),
        organisation: null as null | any,
        isAdmin: false,
        _subscribed: false,
        organisations: [] as any[]
    }),

    actions: {
        async ensureSubscribed() {
            if(this._subscribed) return;

            subscribeToUser(refreshUserData);
            this._subscribed = true;
            this.isAdmin = (await checkIfUserIsAdmin()).isAdmin;
            this.organisations = await getOrganisations();

            if(this.pb?.organisation) {
                this.organisation = await getOrganisation(this.pb.organisation);
            }
        },

        init() {
            this.ensureSubscribed();
        }
    }
});