import { defineStore } from "pinia";
import {
    getActiveSubscription,
    getSubscriptions,
    subscribeToSubscriptions
} from "~/services/subscriptions";
import {getSignedInUser} from "~/services/auth";

export const useBillingStore = defineStore("billing", {
    state: () => ({
        activeSubscription: null as Record<string, any> | null,
        subscriptionHistory: [] as any[],
        loaded: false,
        loadingHistory: false,
        _subscribed: false,
    }),

    actions: {
        async ensureSubscribed() {
            if(this._subscribed) {
                return;
            }
            await this.reloadSubscriptionData();

            subscribeToSubscriptions(async () => {
                await this.reloadSubscriptionData();
            });
            this._subscribed = true;
        },

        async reloadSubscriptionData() {
            try {
                this.activeSubscription = (await getActiveSubscription())?.subscription || null;
            } catch (err) {
                console.warn("Failed to fetch active subscription:", err);
                this.activeSubscription = null;
            }

            try {
                this.loadingHistory = true;
                const user = getSignedInUser();
                if (user?.organisation) {
                    const result = await getSubscriptions(1, 50, {
                        expand: 'plan',
                        sort: '-created',
                        filter: `organisation = '${user.organisation}'`
                    });
                    this.subscriptionHistory = result?.items || [];
                } else if (user?.id) {
                    const result = await getSubscriptions(1, 50, {
                        expand: 'plan',
                        sort: '-created',
                        filter: `individual = '${user.id}'`
                    });
                    this.subscriptionHistory = result?.items || [];
                }
            } catch (err) {
                console.warn("Failed to fetch subscription history:", err);
                this.subscriptionHistory = [];
            } finally {
                this.loadingHistory = false;
                this.loaded = true;
            }
        },

        init() {
            this.ensureSubscribed();
        }
    }
})