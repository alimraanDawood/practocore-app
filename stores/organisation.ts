import { defineStore } from 'pinia'
import {
  getOrganisation,
  updateOrganisation,
  getOrganisationUsers,
  getDirectInvites,
  subscribeToDirectInvites,
  updateMemberRole,
  removeMember,
  getMemberDetails,
  transferOwnership,
  bulkUpdateMembers,
  sendDirectInvite,
  resendInvite,
  revokeInvite
} from '~/services/admin'

// Cache durations
const ORG_CACHE_TTL = 10 * 60 * 1000 // 10 minutes for org data (very stable)
const MEMBERS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes for members list
const INVITES_CACHE_TTL = 2 * 60 * 1000 // 2 minutes for invites (more dynamic)

interface OrganisationData {
  id: string
  name: string
  legalBusinessName?: string
  emailDomain?: string
  owner?: string
  [key: string]: any
}

interface MemberCache {
  items: any[]
  totalItems: number
  totalPages: number
  page: number
  perPage: number
  timestamp: number
  filters?: {
    sort?: string
    filter?: string
    expand?: string
  }
}

interface InviteCache {
  items: any[]
  totalItems: number
  totalPages: number
  page: number
  perPage: number
  timestamp: number
  filters?: {
    sort?: string
    filter?: string
    expand?: string
  }
}

export const useOrganisationStore = defineStore('organisation', {
  state: () => ({
    // Organization data
    organisation: null as OrganisationData | null,
    organisationFetched: 0,

    // Members
    membersCache: null as MemberCache | null,
    loadingMembers: false,
    backgroundRefreshingMembers: false,

    // Invites
    invitesCache: null as InviteCache | null,
    loadingInvites: false,
    backgroundRefreshingInvites: false,

    // Individual member details cache
    memberDetailsCache: {} as Record<string, { data: any; timestamp: number }>,

    // Loading states
    loadingOrg: false,
    updatingOrg: false,

    // Subscription states
    _subscribedToInvites: false,

    // Errors
    orgError: null as string | null,
    membersError: null as string | null,
    invitesError: null as string | null,

    // Last used filters
    _lastMemberFilters: {
      sort: '',
      filter: '',
      expand: 'avatar',
      page: 1,
      perPage: 10
    },
    _lastInviteFilters: {
      sort: '-created',
      filter: '',
      expand: '',
      page: 1,
      perPage: 10
    }
  }),

  getters: {
    // Check if org data is stale
    isOrgStale(state) {
      if (!state.organisationFetched) return true
      return Date.now() - state.organisationFetched > ORG_CACHE_TTL
    },

    // Check if members cache is stale
    isMembersCacheStale(state) {
      if (!state.membersCache) return true

      // Check if filters changed
      const filtersChanged =
        state._lastMemberFilters.sort !== (state.membersCache.filters?.sort || '') ||
        state._lastMemberFilters.filter !== (state.membersCache.filters?.filter || '') ||
        state._lastMemberFilters.page !== state.membersCache.page ||
        state._lastMemberFilters.perPage !== state.membersCache.perPage

      if (filtersChanged) return true

      return Date.now() - state.membersCache.timestamp > MEMBERS_CACHE_TTL
    },

    // Check if invites cache is stale
    isInvitesCacheStale(state) {
      if (!state.invitesCache) return true

      // Check if filters changed
      const filtersChanged =
        state._lastInviteFilters.sort !== (state.invitesCache.filters?.sort || '') ||
        state._lastInviteFilters.filter !== (state.invitesCache.filters?.filter || '') ||
        state._lastInviteFilters.page !== state.invitesCache.page ||
        state._lastInviteFilters.perPage !== state.invitesCache.perPage

      if (filtersChanged) return true

      return Date.now() - state.invitesCache.timestamp > INVITES_CACHE_TTL
    },

    // Get members list
    members(state) {
      return state.membersCache?.items || []
    },

    // Get invites list
    invites(state) {
      return state.invitesCache?.items || []
    },

    // Get member statistics
    memberStats(state) {
      const members = state.membersCache?.items || []
      return {
        total: state.membersCache?.totalItems || 0,
        admins: members.filter(m => m.role === 'admin').length,
        moderators: members.filter(m => m.role === 'moderator').length,
        members: members.filter(m => m.role === 'member').length
      }
    },

    // Get invite statistics
    inviteStats(state) {
      const invites = state.invitesCache?.items || []
      return {
        total: state.invitesCache?.totalItems || 0,
        pending: invites.filter(i => i.status === 'pending').length,
        accepted: invites.filter(i => i.status === 'accepted').length,
        expired: invites.filter(i => i.status === 'expired').length,
        rejected: invites.filter(i => i.status === 'rejected').length
      }
    }
  },

  actions: {
    // Fetch organization data
    async fetchOrganisation(orgId: string, force = false) {
      // Use cache if available and fresh
      if (!force && this.organisation && this.organisation.id === orgId && !this.isOrgStale) {
        return this.organisation
      }

      this.loadingOrg = true
      this.orgError = null

      try {
        const result = await getOrganisation(orgId)

        this.organisation = result
        this.organisationFetched = Date.now()

        return result
      } catch (error) {
        console.error('Failed to fetch organisation:', error)
        this.orgError = error instanceof Error ? error.message : 'Failed to fetch organisation'
        throw error
      } finally {
        this.loadingOrg = false
      }
    },

    // Update organization with optimistic update
    async updateOrganisationData(orgId: string, updates: Partial<OrganisationData>) {
      if (!this.organisation) {
        throw new Error('No organisation data available')
      }

      // Store original for rollback
      const original = { ...this.organisation }

      // Optimistic update
      this.organisation = {
        ...this.organisation,
        ...updates
      }

      this.updatingOrg = true
      this.orgError = null

      try {
        const result = await updateOrganisation(orgId, updates)

        // Update with real data
        this.organisation = result
        this.organisationFetched = Date.now()

        return result
      } catch (error) {
        // Rollback on error
        this.organisation = original
        console.error('Failed to update organisation:', error)
        this.orgError = error instanceof Error ? error.message : 'Failed to update organisation'
        throw error
      } finally {
        this.updatingOrg = false
      }
    },

    // Fetch members
    async fetchMembers(page = 1, perPage = 10, options: any = {}, force = false, background = false) {
      // Update last filters
      this._lastMemberFilters = {
        sort: options.sort || '',
        filter: options.filter || '',
        expand: options.expand || 'avatar',
        page,
        perPage
      }

      // Use cache if available and fresh
      if (!force && !this.isMembersCacheStale) {
        // Background refresh if cache is getting old
        const cacheAge = Date.now() - this.membersCache!.timestamp
        if (cacheAge > MEMBERS_CACHE_TTL * 0.75 && !this.backgroundRefreshingMembers) {
          this.fetchMembersInBackground()
        }

        return {
          items: this.membersCache!.items,
          totalItems: this.membersCache!.totalItems,
          totalPages: this.membersCache!.totalPages,
          page: this.membersCache!.page,
          perPage: this.membersCache!.perPage
        }
      }

      if (background) {
        this.backgroundRefreshingMembers = true
      } else {
        this.loadingMembers = true
      }

      this.membersError = null

      try {
        const result = await getOrganisationUsers(page, perPage, {
          expand: 'avatar',
          ...options
        })

        this.membersCache = {
          items: result.items,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          page: result.page,
          perPage: result.perPage,
          timestamp: Date.now(),
          filters: {
            sort: options.sort,
            filter: options.filter,
            expand: options.expand
          }
        }

        return result
      } catch (error) {
        console.error('Failed to fetch members:', error)
        this.membersError = error instanceof Error ? error.message : 'Failed to fetch members'
        throw error
      } finally {
        if (background) {
          this.backgroundRefreshingMembers = false
        } else {
          this.loadingMembers = false
        }
      }
    },

    // Fetch members in background
    async fetchMembersInBackground() {
      const { page, perPage } = this._lastMemberFilters
      return this.fetchMembers(page, perPage, this._lastMemberFilters, true, true)
    },

    // Fetch member details
    async fetchMemberDetails(userId: string, force = false) {
      // Check cache first
      const cached = this.memberDetailsCache[userId]
      if (!force && cached && Date.now() - cached.timestamp < MEMBERS_CACHE_TTL) {
        return cached.data
      }

      try {
        const result = await getMemberDetails(userId)

        this.memberDetailsCache[userId] = {
          data: result,
          timestamp: Date.now()
        }

        return result
      } catch (error) {
        console.error('Failed to fetch member details:', error)
        throw error
      }
    },

    // Update member role with optimistic update
    async updateMemberRoleOptimistic(userId: string, orgId: string, newRole: string) {
      // Store original for rollback
      let originalMember: any = null
      if (this.membersCache) {
        originalMember = this.membersCache.items.find(m => m.id === userId)

        // Optimistic update
        this.membersCache.items = this.membersCache.items.map(m =>
          m.id === userId ? { ...m, role: newRole } : m
        )
      }

      try {
        const result = await updateMemberRole(userId, orgId, newRole)

        // Update member details cache if exists
        if (this.memberDetailsCache[userId]) {
          this.memberDetailsCache[userId].data = {
            ...this.memberDetailsCache[userId].data,
            role: newRole
          }
        }

        return result
      } catch (error) {
        // Rollback on error
        if (originalMember && this.membersCache) {
          this.membersCache.items = this.membersCache.items.map(m =>
            m.id === userId ? originalMember : m
          )
        }

        console.error('Failed to update member role:', error)
        throw error
      }
    },

    // Remove member with optimistic update
    async removeMemberOptimistic(userId: string, orgId: string) {
      // Store original for rollback
      const originalItems = this.membersCache?.items
      const originalTotal = this.membersCache?.totalItems

      // Optimistic update
      if (this.membersCache) {
        this.membersCache.items = this.membersCache.items.filter(m => m.id !== userId)
        this.membersCache.totalItems--
      }

      // Remove from details cache
      delete this.memberDetailsCache[userId]

      try {
        const result = await removeMember(userId, orgId)
        return result
      } catch (error) {
        // Rollback on error
        if (originalItems && this.membersCache) {
          this.membersCache.items = originalItems
          this.membersCache.totalItems = originalTotal || 0
        }

        console.error('Failed to remove member:', error)
        throw error
      }
    },

    // Bulk update members
    async bulkUpdateMembersOptimistic(userIds: string[], orgId: string, action: string) {
      // Store original for rollback
      const originalItems = this.membersCache?.items

      try {
        const result = await bulkUpdateMembers(userIds, orgId, action)

        // Refresh members list after bulk operation
        await this.fetchMembersInBackground()

        return result
      } catch (error) {
        // Rollback on error
        if (originalItems && this.membersCache) {
          this.membersCache.items = originalItems
        }

        console.error('Failed to bulk update members:', error)
        throw error
      }
    },

    // Transfer ownership
    async transferOwnershipOptimistic(newOwnerId: string, orgId: string) {
      try {
        const result = await transferOwnership(newOwnerId, orgId)

        // Refresh both org and members data
        await Promise.all([
          this.fetchOrganisation(orgId, true),
          this.fetchMembersInBackground()
        ])

        return result
      } catch (error) {
        console.error('Failed to transfer ownership:', error)
        throw error
      }
    },

    // Fetch invites
    async fetchInvites(page = 1, perPage = 10, options: any = {}, force = false, background = false) {
      // Update last filters
      this._lastInviteFilters = {
        sort: options.sort || '-created',
        filter: options.filter || '',
        expand: options.expand || '',
        page,
        perPage
      }

      // Use cache if available and fresh
      if (!force && !this.isInvitesCacheStale) {
        // Background refresh if cache is getting old
        const cacheAge = Date.now() - this.invitesCache!.timestamp
        if (cacheAge > INVITES_CACHE_TTL * 0.75 && !this.backgroundRefreshingInvites) {
          this.fetchInvitesInBackground()
        }

        return {
          items: this.invitesCache!.items,
          totalItems: this.invitesCache!.totalItems,
          totalPages: this.invitesCache!.totalPages,
          page: this.invitesCache!.page,
          perPage: this.invitesCache!.perPage
        }
      }

      if (background) {
        this.backgroundRefreshingInvites = true
      } else {
        this.loadingInvites = true
      }

      this.invitesError = null

      try {
        const result = await getDirectInvites(page, perPage, {
          sort: '-created',
          ...options
        })

        this.invitesCache = {
          items: result.items,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          page: result.page,
          perPage: result.perPage,
          timestamp: Date.now(),
          filters: {
            sort: options.sort,
            filter: options.filter,
            expand: options.expand
          }
        }

        return result
      } catch (error) {
        console.error('Failed to fetch invites:', error)
        this.invitesError = error instanceof Error ? error.message : 'Failed to fetch invites'
        throw error
      } finally {
        if (background) {
          this.backgroundRefreshingInvites = false
        } else {
          this.loadingInvites = false
        }
      }
    },

    // Fetch invites in background
    async fetchInvitesInBackground() {
      const { page, perPage } = this._lastInviteFilters
      return this.fetchInvites(page, perPage, this._lastInviteFilters, true, true)
    },

    // Send direct invite with optimistic update
    async sendDirectInviteOptimistic(email: string, orgId: string, role = 'member', name?: string) {
      const tempId = `temp_${Date.now()}`
      const optimisticInvite = {
        id: tempId,
        email,
        organisation: orgId,
        role,
        name,
        status: 'pending',
        created: new Date().toISOString()
      }

      // Optimistic update
      if (this.invitesCache) {
        this.invitesCache.items = [optimisticInvite, ...this.invitesCache.items]
        this.invitesCache.totalItems++
      }

      try {
        const result = await sendDirectInvite(email, orgId, role, name)

        // Replace optimistic entry with real data
        if (this.invitesCache) {
          this.invitesCache.items = this.invitesCache.items.map(i =>
            i.id === tempId ? result.invite : i
          )
        }

        return result
      } catch (error) {
        // Rollback on error
        if (this.invitesCache) {
          this.invitesCache.items = this.invitesCache.items.filter(i => i.id !== tempId)
          this.invitesCache.totalItems--
        }

        console.error('Failed to send invite:', error)
        throw error
      }
    },

    // Resend invite
    async resendInviteOptimistic(inviteId: string) {
      try {
        const result = await resendInvite(inviteId)

        // Update invite timestamp in cache
        if (this.invitesCache) {
          this.invitesCache.items = this.invitesCache.items.map(i =>
            i.id === inviteId ? { ...i, updated: new Date().toISOString() } : i
          )
        }

        return result
      } catch (error) {
        console.error('Failed to resend invite:', error)
        throw error
      }
    },

    // Revoke invite with optimistic update
    async revokeInviteOptimistic(inviteId: string) {
      // Store original for rollback
      const originalItems = this.invitesCache?.items
      const originalTotal = this.invitesCache?.totalItems

      // Optimistic update
      if (this.invitesCache) {
        this.invitesCache.items = this.invitesCache.items.filter(i => i.id !== inviteId)
        this.invitesCache.totalItems--
      }

      try {
        const result = await revokeInvite(inviteId)
        return result
      } catch (error) {
        // Rollback on error
        if (originalItems && this.invitesCache) {
          this.invitesCache.items = originalItems
          this.invitesCache.totalItems = originalTotal || 0
        }

        console.error('Failed to revoke invite:', error)
        throw error
      }
    },

    // Setup realtime subscriptions
    ensureInvitesSubscribed() {
      if (this._subscribedToInvites) return

      subscribeToDirectInvites((data: any) => {
        const { action, record } = data

        switch (action) {
          case 'create':
            if (this.invitesCache) {
              // Add to cache if not already present
              const exists = this.invitesCache.items.find(i => i.id === record.id)
              if (!exists) {
                this.invitesCache.items = [record, ...this.invitesCache.items]
                this.invitesCache.totalItems++
              }
            }
            break

          case 'update':
            if (this.invitesCache) {
              this.invitesCache.items = this.invitesCache.items.map(i =>
                i.id === record.id ? record : i
              )
            }
            break

          case 'delete':
            if (this.invitesCache) {
              this.invitesCache.items = this.invitesCache.items.filter(i => i.id !== record.id)
              this.invitesCache.totalItems--
            }
            break
        }
      })

      this._subscribedToInvites = true
    },

    // Clear all caches
    clearCache() {
      this.organisation = null
      this.organisationFetched = 0
      this.membersCache = null
      this.invitesCache = null
      this.memberDetailsCache = {}
      this.orgError = null
      this.membersError = null
      this.invitesError = null
    },

    // Invalidate specific caches
    invalidateOrgCache() {
      this.organisationFetched = 0
    },

    invalidateMembersCache() {
      this.membersCache = null
      this.memberDetailsCache = {}
    },

    invalidateInvitesCache() {
      this.invitesCache = null
    }
  }
})
