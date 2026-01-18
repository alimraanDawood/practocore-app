import { defineStore } from "pinia";
import {getSubscriptions, subscribeToSubscriptions} from "~/services/subscriptions";

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
            this.activeSubscription = (await getSubscriptions(1, 1, { filter: `active = true`, sort: '-created' })).items[0] || null;
            this.subscriptionHistory = (await getSubscriptions(1, 1, { sort: '-created' }));
        },

        init() {
            this.ensureSubscribed();
        }
    }
})