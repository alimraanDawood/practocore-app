import { defineStore } from 'pinia'
import {
  getSubscriptionPlans,
  getUserSubscription,
  getSubscriptionStatus,
  getProviderInfo,
  type SubscriptionPlan,
  type Subscription,
  type ProviderInfo
} from '~/services/subscriptions'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    // Available plans
    plans: [] as SubscriptionPlan[],
    plansFetched: 0,

    // User subscription
    subscription: null as Subscription | null,
    subscriptionFetched: 0,

    // Status
    status: 'none' as 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'none',

    // Provider info
    providerInfo: null as ProviderInfo | null,
    providerInfoFetched: 0,

    // Loading
    loading: false,
    error: null as string | null
  }),

  getters: {
    isActive: (state) => state.status === 'active' || state.status === 'trialing',

    isPastDue: (state) => state.status === 'past_due',

    isCanceled: (state) => state.status === 'canceled',

    hasSubscription: (state) => state.subscription !== null,

    currentPlan: (state) => {
      if (!state.subscription) return null
      return state.plans.find(p => p.id === state.subscription?.plan) || null
    },

    providerName: (state) => {
      return state.providerInfo?.provider || state.subscription?.provider || 'unknown'
    },

    hasCustomerPortal: (state) => {
      return state.providerInfo?.hasPortal || false
    },

    isPlansStale: (state) => {
      if (!state.plansFetched) return true
      return Date.now() - state.plansFetched > CACHE_TTL
    },

    isSubscriptionStale: (state) => {
      if (!state.subscriptionFetched) return true
      return Date.now() - state.subscriptionFetched > CACHE_TTL
    },

    isProviderInfoStale: (state) => {
      if (!state.providerInfoFetched) return true
      return Date.now() - state.providerInfoFetched > CACHE_TTL * 2 // 10 minutes
    }
  },

  actions: {
    async fetchProviderInfo(force = false) {
      if (!force && !this.isProviderInfoStale) {
        return this.providerInfo
      }

      try {
        this.providerInfo = await getProviderInfo()
        this.providerInfoFetched = Date.now()
        return this.providerInfo
      } catch (error) {
        console.error('Failed to fetch provider info:', error)
        return null
      }
    },

    async fetchPlans(force = false) {
      if (!force && !this.isPlansStale) {
        return this.plans
      }

      this.loading = true
      this.error = null

      try {
        this.plans = await getSubscriptionPlans()
        this.plansFetched = Date.now()
        return this.plans
      } catch (error) {
        console.error('Failed to fetch plans:', error)
        this.error = error instanceof Error ? error.message : 'Failed to fetch plans'
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchSubscription(userId: string, force = false) {
      if (!force && !this.isSubscriptionStale) {
        return this.subscription
      }

      this.loading = true
      this.error = null

      try {
        this.subscription = await getUserSubscription(userId)

        if (this.subscription) {
          this.status = this.subscription.status
        } else {
          this.status = 'none'
        }

        this.subscriptionFetched = Date.now()
        return this.subscription
      } catch (error) {
        console.error('Failed to fetch subscription:', error)
        this.error = error instanceof Error ? error.message : 'Failed to fetch subscription'
        throw error
      } finally {
        this.loading = false
      }
    },

    async checkStatus(userId: string) {
      try {
        const result = await getSubscriptionStatus(userId)
        this.status = result.status
        return result
      } catch (error) {
        console.error('Failed to check status:', error)
        throw error
      }
    },

    invalidateCache() {
      this.plansFetched = 0
      this.subscriptionFetched = 0
      this.providerInfoFetched = 0
    },

    clearSubscription() {
      this.subscription = null
      this.status = 'none'
      this.subscriptionFetched = 0
    }
  }
})
