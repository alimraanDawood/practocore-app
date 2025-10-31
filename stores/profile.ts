import { defineStore } from 'pinia'
import {
  getSignedInUser,
  getUserPreferences,
  updateUser,
  updateUserPreferences,
  subscribeToUser,
  unsubscribeFromUser,
  refreshUserData
} from '~/services/auth'

// Cache duration: 10 minutes (user profile data is relatively stable)
const CACHE_TTL = 10 * 60 * 1000

interface UserData {
  id: string
  name: string
  email: string
  timezone?: string
  organisation?: string
  role?: string
  avatar?: string
  preferences?: string
  [key: string]: any
}

interface UserPreferences {
  id: string
  emailNotifications?: boolean
  appNotifications?: boolean
  pushNotifications?: boolean
  reminderTime?: string
  [key: string]: any
}

export const useProfileStore = defineStore('profile', {
  state: () => ({
    // User data
    user: null as UserData | null,
    userFetched: 0,

    // User preferences
    preferences: null as UserPreferences | null,
    preferencesFetched: 0,

    // Loading states
    loadingUser: false,
    loadingPreferences: false,
    updatingUser: false,
    updatingPreferences: false,

    // Subscription state
    _subscribed: false,

    // Error states
    userError: null as string | null,
    preferencesError: null as string | null
  }),

  getters: {
    // Check if user data is stale
    isUserStale(state) {
      if (!state.userFetched) return true
      return Date.now() - state.userFetched > CACHE_TTL
    },

    // Check if preferences are stale
    isPreferencesStale(state) {
      if (!state.preferencesFetched) return true
      return Date.now() - state.preferencesFetched > CACHE_TTL
    },

    // Get user display name
    displayName(state) {
      return state.user?.name || state.user?.email || 'User'
    },

    // Get user initials for avatar
    initials(state) {
      const name = state.user?.name || state.user?.email || 'U'
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    },

    // Check if user has complete profile
    isProfileComplete(state) {
      return !!(
        state.user?.name &&
        state.user?.email &&
        state.user?.timezone
      )
    }
  },

  actions: {
    // Fetch user data
    async fetchUser(force = false) {
      // Use cache if available and fresh
      if (!force && this.user && !this.isUserStale) {
        return this.user
      }

      this.loadingUser = true
      this.userError = null

      try {
        // getSignedInUser is synchronous - it reads from authStore
        const userData = getSignedInUser()

        if (!userData) {
          throw new Error('No user signed in')
        }

        this.user = userData
        this.userFetched = Date.now()

        return userData
      } catch (error) {
        console.error('Failed to fetch user:', error)
        this.userError = error instanceof Error ? error.message : 'Failed to fetch user'
        throw error
      } finally {
        this.loadingUser = false
      }
    },

    // Fetch user preferences
    async fetchPreferences(force = false) {
      // Use cache if available and fresh
      if (!force && this.preferences && !this.isPreferencesStale) {
        return this.preferences
      }

      this.loadingPreferences = true
      this.preferencesError = null

      try {
        const preferencesData = await getUserPreferences()

        if (!preferencesData) {
          throw new Error('Failed to fetch preferences')
        }

        this.preferences = preferencesData
        this.preferencesFetched = Date.now()

        return preferencesData
      } catch (error) {
        console.error('Failed to fetch preferences:', error)
        this.preferencesError = error instanceof Error ? error.message : 'Failed to fetch preferences'
        throw error
      } finally {
        this.loadingPreferences = false
      }
    },

    // Fetch both user and preferences
    async fetchAll(force = false) {
      const [user, preferences] = await Promise.all([
        this.fetchUser(force),
        this.fetchPreferences(force)
      ])

      return { user, preferences }
    },

    // Update user with optimistic update
    async updateUserData(updates: Partial<UserData>) {
      if (!this.user) {
        throw new Error('No user data available')
      }

      // Store original for rollback
      const original = { ...this.user }

      // Optimistic update
      this.user = {
        ...this.user,
        ...updates
      }

      this.updatingUser = true
      this.userError = null

      try {
        const result = await updateUser(updates)

        // Update with real data from server
        this.user = result
        this.userFetched = Date.now()

        // Refresh auth store data
        await refreshUserData()

        return result
      } catch (error) {
        // Rollback on error
        this.user = original
        console.error('Failed to update user:', error)
        this.userError = error instanceof Error ? error.message : 'Failed to update user'
        throw error
      } finally {
        this.updatingUser = false
      }
    },

    // Update preferences with optimistic update
    async updatePreferencesData(updates: Partial<UserPreferences>) {
      if (!this.preferences) {
        throw new Error('No preferences data available')
      }

      // Store original for rollback
      const original = { ...this.preferences }

      // Optimistic update
      this.preferences = {
        ...this.preferences,
        ...updates
      }

      this.updatingPreferences = true
      this.preferencesError = null

      try {
        const result = await updateUserPreferences(updates)

        // Update with real data from server
        this.preferences = result
        this.preferencesFetched = Date.now()

        return result
      } catch (error) {
        // Rollback on error
        this.preferences = original
        console.error('Failed to update preferences:', error)
        this.preferencesError = error instanceof Error ? error.message : 'Failed to update preferences'
        throw error
      } finally {
        this.updatingPreferences = false
      }
    },

    // Clear all cached data (on logout)
    clearCache() {
      this.user = null
      this.preferences = null
      this.userFetched = 0
      this.preferencesFetched = 0
      this.userError = null
      this.preferencesError = null
    },

    // Invalidate cache (force refresh on next access)
    invalidateCache() {
      this.userFetched = 0
      this.preferencesFetched = 0
    },

    // Setup realtime subscription
    ensureSubscribed() {
      if (this._subscribed) return

      try {
        subscribeToUser((data: any) => {
          const { action, record } = data

          if (action === 'update' && this.user && record.id === this.user.id) {
            // Update user data from subscription
            this.user = {
              ...this.user,
              ...record
            }
            this.userFetched = Date.now()
          }
        })

        this._subscribed = true
      } catch (error) {
        console.error('Failed to setup user subscription:', error)
      }
    },

    // Cleanup subscription
    unsubscribe() {
      if (this._subscribed) {
        unsubscribeFromUser()
        this._subscribed = false
      }
    },

    // Refresh user data in background
    async refreshInBackground() {
      try {
        await Promise.all([
          this.fetchUser(true),
          this.fetchPreferences(true)
        ])
      } catch (error) {
        console.error('Background refresh failed:', error)
      }
    }
  }
})
