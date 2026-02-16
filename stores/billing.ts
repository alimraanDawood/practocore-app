import { defineStore } from "pinia";
import {
    getActiveSubscription,
    getSubscription,
    getSubscriptions,
    subscribeToSubscriptions
} from "~/services/subscriptions";
import {getSignedInUser} from "~/services/auth";

export const useBillingStore = defineStore("billing", {
    state: () => ({
        activeSubscription: null,
        subscriptionHistory: [] as any[],
        loaded: false,
        _subscribed: false,
    }),

    actions: {
        async ensureSubscribed() {
            if(this._subscribed) {
                return;
            }
            await this.reloadSubscriptionData();

            subscribeToSubscriptions(this.reloadSubscriptionData);
            this._subscribed = true;
        },

        async reloadSubscriptionData() {
            if(getSignedInUser()?.organisation) {

            }

            this.activeSubscription = (await getActiveSubscription())?.subscription || null;
            this.subscriptionHistory = (await getSubscriptions(1, 1, { expand: 'plan', sort: '-created' }));
        },

        init() {
            this.ensureSubscribed();
        }
    }
})