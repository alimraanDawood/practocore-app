import { defineStore } from 'pinia';
import {getOrganisation, getOrganisations, getSignedInUser, refreshUserData, subscribeToUser} from "~/services/auth";
import {checkIfUserIsAdmin} from "~/services/admin";
import {handleWorkspaceDrift} from "~/composables/useWorkspace";

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

            // The realtime user subscription is also how this tab learns that its
            // workspace moved out from under it — the pointer is a column on the
            // auth record, so another tab or device switching writes right here.
            // authRefresh first, so the record is current before we compare.
            subscribeToUser(async () => {
                try {
                    await refreshUserData();
                } catch {
                    // A failed refresh is not a reason to skip the drift check —
                    // fall through and compare whatever the record currently says.
                }
                handleWorkspaceDrift();
            });
            this._subscribed = true;
            // Isolated: this call throws on a non-2xx reply now, and the
            // organisations below are needed for the workspace switcher whether
            // or not the admin probe succeeded. Failing closed (not an admin) is
            // the safe default, but it is worth a warning — a silent false here
            // is what hides the Lawyers nav from a real admin.
            try {
                this.isAdmin = (await checkIfUserIsAdmin()).isAdmin;
            } catch (error) {
                console.warn('Could not determine admin status; assuming member.', error);
                this.isAdmin = false;
            }
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