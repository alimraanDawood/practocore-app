/**
 * Provider-Agnostic Subscription Service
 *
 * Works with any payment provider through the backend abstraction layer
 */

import { pocketbase, SERVER_URL } from '~/services/auth'

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: string[]
  providerPriceId: string
  active: boolean
  order: number
}

export interface Subscription {
  id: string
  user: string
  organisation?: string
  plan: string
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
  provider: string
  providerSubscriptionId: string
  providerCustomerId: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
}

export interface PaymentHistory {
  id: string
  user: string
  subscription: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'pending' | 'refunded'
  provider: string
  providerPaymentId: string
  receiptUrl?: string
  created: string
}

export interface ProviderInfo {
  provider: string
  hasPortal: boolean
  config: {
    publicKey: string
  }
}

/**
 * Get payment provider information
 */
export async function getProviderInfo(): Promise<ProviderInfo> {
  return await fetch(`${SERVER_URL}/api/subscriptions/provider-info`, {
    headers: {
      Authorization: `Bearer ${pocketbase.authStore.token}`
    }
  }).then(res => res.json())
}

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const result = await fetch(`${SERVER_URL}/api/subscriptions/plans`, {
    headers: {
      Authorization: `Bearer ${pocketbase.authStore.token}`
    }
  }).then(res => res.json())

  return result.plans || []
}

/**
 * Create a checkout session with the current payment provider
 */
export async function createCheckoutSession(
  priceId: string,
  userId: string,
  organisationId?: string
) {
  return await fetch(`${SERVER_URL}/api/subscriptions/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`
    },
    body: JSON.stringify({
      priceId,
      userId,
      organisationId
    })
  }).then(res => res.json())
}

/**
 * Create a customer portal session (if provider supports it)
 */
export async function createPortalSession(customerId: string) {
  return await fetch(`${SERVER_URL}/api/subscriptions/create-portal-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`
    },
    body: JSON.stringify({ customerId })
  }).then(res => res.json())
}

/**
 * Get user subscription status
 */
export async function getSubscriptionStatus(userId: string) {
  return await fetch(`${SERVER_URL}/api/subscriptions/status/${userId}`, {
    headers: {
      Authorization: `Bearer ${pocketbase.authStore.token}`
    }
  }).then(res => res.json())
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  return await fetch(`${SERVER_URL}/api/subscriptions/cancel/${subscriptionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`
    }
  }).then(res => res.json())
}

/**
 * Reactivate subscription
 */
export async function reactivateSubscription(subscriptionId: string) {
  return await fetch(`${SERVER_URL}/api/subscriptions/reactivate/${subscriptionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`
    }
  }).then(res => res.json())
}

/**
 * Get user's current subscription from local database
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const result = await pocketbase
      .collection('Subscriptions')
      .getFirstListItem<Subscription>(`user = "${userId}"`, {
        sort: '-created'
      })
    return result
  } catch (error) {
    return null
  }
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
  try {
    // Try to get from provider first (more up-to-date)
    const result = await fetch(`${SERVER_URL}/api/subscriptions/payment-history/${userId}`, {
      headers: {
        Authorization: `Bearer ${pocketbase.authStore.token}`
      }
    }).then(res => res.json())

    if (result.payments) {
      return result.payments
    }
  } catch (error) {
    console.error('Failed to fetch payment history from provider:', error)
  }

  // Fallback to local database
  try {
    const records = await pocketbase
      .collection('PaymentHistory')
      .getList<PaymentHistory>(1, 50, {
        filter: `user = "${userId}"`,
        sort: '-created'
      })

    return records.items
  } catch (error) {
    console.error('Failed to fetch payment history from database:', error)
    return []
  }
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId)
  return subscription?.status === 'active' || subscription?.status === 'trialing'
}
