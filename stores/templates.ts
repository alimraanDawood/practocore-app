import { defineStore } from 'pinia'
import {
  getAllTemplates,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  subscribeToTemplates,
  unsubscribeToTemplates
} from '~/services/templates'

// Cache duration: 5 minutes for templates (relatively stable data)
const CACHE_TTL = 5 * 60 * 1000

interface TemplateCache {
  [id: string]: {
    data: any
    timestamp: number
  }
}

interface ListCache {
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

export const useTemplatesStore = defineStore('templates', {
  state: () => ({
    // Individual template cache (by ID)
    templateCache: {} as TemplateCache,

    // List cache (paginated results)
    listCache: null as ListCache | null,

    // All templates cache (for dropdowns/selects)
    allTemplates: [] as any[],
    allTemplatesFetched: 0,

    // Loading states
    loading: false,
    loadingById: {} as Record<string, boolean>,

    // Subscription state
    _subscribed: false,

    // Last used filters
    _lastFilters: {
      sort: '',
      filter: '',
      expand: '',
      page: 1,
      perPage: 10
    }
  }),

  getters: {
    // Check if list cache is stale
    isListCacheStale(state) {
      if (!state.listCache) return true

      // Check if filters changed
      const filtersChanged =
        state._lastFilters.sort !== (state.listCache.filters?.sort || '') ||
        state._lastFilters.filter !== (state.listCache.filters?.filter || '') ||
        state._lastFilters.page !== state.listCache.page ||
        state._lastFilters.perPage !== state.listCache.perPage

      if (filtersChanged) return true

      // Check TTL
      return Date.now() - state.listCache.timestamp > CACHE_TTL
    },

    // Check if all templates cache is stale
    isAllTemplatesStale(state) {
      if (!state.allTemplatesFetched) return true
      return Date.now() - state.allTemplatesFetched > CACHE_TTL
    },

    // Get template by ID from cache
    getTemplateById: (state) => (id: string) => {
      const cached = state.templateCache[id]
      if (!cached) return null

      // Check if stale
      if (Date.now() - cached.timestamp > CACHE_TTL) {
        return null
      }

      return cached.data
    }
  },

  actions: {
    // Fetch all templates (for dropdowns/selects)
    async fetchAllTemplates(force = false) {
      if (!force && !this.isAllTemplatesStale) {
        return this.allTemplates
      }

      this.loading = true

      try {
        const result = await getAllTemplates()

        this.allTemplates = result
        this.allTemplatesFetched = Date.now()

        // Also update individual caches
        result.forEach((template: any) => {
          this.templateCache[template.id] = {
            data: template,
            timestamp: Date.now()
          }
        })

        return result
      } catch (error) {
        console.error('Failed to fetch all templates:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // Fetch paginated templates
    async fetchTemplates(page = 1, perPage = 10, options: any = {}, force = false) {
      // Update last filters
      this._lastFilters = {
        sort: options.sort || '',
        filter: options.filter || '',
        expand: options.expand || '',
        page,
        perPage
      }

      // Use cache if available and fresh
      if (!force && !this.isListCacheStale) {
        return {
          items: this.listCache!.items,
          totalItems: this.listCache!.totalItems,
          totalPages: this.listCache!.totalPages,
          page: this.listCache!.page,
          perPage: this.listCache!.perPage
        }
      }

      this.loading = true

      try {
        const result = await getTemplates(page, perPage, options)

        // Update list cache
        this.listCache = {
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

        // Update individual template caches
        result.items.forEach((template: any) => {
          this.templateCache[template.id] = {
            data: template,
            timestamp: Date.now()
          }
        })

        return result
      } catch (error) {
        console.error('Failed to fetch templates:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // Fetch single template by ID
    async fetchTemplate(id: string, force = false) {
      // Check cache first
      if (!force) {
        const cached = this.getTemplateById(id)
        if (cached) return cached
      }

      this.loadingById[id] = true

      try {
        const result = await getTemplate(id)

        // Update cache
        this.templateCache[id] = {
          data: result,
          timestamp: Date.now()
        }

        return result
      } catch (error) {
        console.error(`Failed to fetch template ${id}:`, error)
        throw error
      } finally {
        this.loadingById[id] = false
      }
    },

    // Create new template with optimistic update
    async createNewTemplate(templateData: any) {
      // Generate temporary ID for optimistic update
      const tempId = `temp_${Date.now()}`
      const optimisticTemplate = {
        ...templateData,
        id: tempId,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }

      // Optimistic update - add to caches immediately
      if (this.listCache) {
        this.listCache.items = [optimisticTemplate, ...this.listCache.items]
        this.listCache.totalItems++
      }

      this.allTemplates = [optimisticTemplate, ...this.allTemplates]

      try {
        const result = await createTemplate(templateData)

        // Replace optimistic entry with real data
        if (this.listCache) {
          this.listCache.items = this.listCache.items.map(t =>
            t.id === tempId ? result : t
          )
        }

        this.allTemplates = this.allTemplates.map(t =>
          t.id === tempId ? result : t
        )

        // Add to cache
        this.templateCache[result.id] = {
          data: result,
          timestamp: Date.now()
        }

        return result
      } catch (error) {
        // Rollback optimistic update
        if (this.listCache) {
          this.listCache.items = this.listCache.items.filter(t => t.id !== tempId)
          this.listCache.totalItems--
        }

        this.allTemplates = this.allTemplates.filter(t => t.id !== tempId)

        console.error('Failed to create template:', error)
        throw error
      }
    },

    // Update template with optimistic update
    async updateExistingTemplate(id: string, templateData: any) {
      // Store original for rollback
      const originalCache = this.templateCache[id]?.data
      const originalListItem = this.listCache?.items.find(t => t.id === id)
      const originalAllItem = this.allTemplates.find(t => t.id === id)

      // Optimistic update
      const optimisticData = {
        ...(originalCache || originalListItem || originalAllItem),
        ...templateData,
        updated: new Date().toISOString()
      }

      // Update caches immediately
      if (this.templateCache[id]) {
        this.templateCache[id].data = optimisticData
      }

      if (this.listCache) {
        this.listCache.items = this.listCache.items.map(t =>
          t.id === id ? optimisticData : t
        )
      }

      this.allTemplates = this.allTemplates.map(t =>
        t.id === id ? optimisticData : t
      )

      try {
        // const result = await updateTemplate(id, templateData)

        // Update with real data
        this.templateCache[id] = {
          data: result,
          timestamp: Date.now()
        }

        if (this.listCache) {
          this.listCache.items = this.listCache.items.map(t =>
            t.id === id ? result : t
          )
        }

        this.allTemplates = this.allTemplates.map(t =>
          t.id === id ? result : t
        )

        return result
      } catch (error) {
        // Rollback optimistic update
        if (originalCache && this.templateCache[id]) {
          this.templateCache[id].data = originalCache
        }

        if (originalListItem && this.listCache) {
          this.listCache.items = this.listCache.items.map(t =>
            t.id === id ? originalListItem : t
          )
        }

        if (originalAllItem) {
          this.allTemplates = this.allTemplates.map(t =>
            t.id === id ? originalAllItem : t
          )
        }

        console.error(`Failed to update template ${id}:`, error)
        throw error
      }
    },

    // Delete template from caches
    deleteTemplateFromCache(id: string) {
      delete this.templateCache[id]

      if (this.listCache) {
        this.listCache.items = this.listCache.items.filter(t => t.id !== id)
        this.listCache.totalItems--
      }

      this.allTemplates = this.allTemplates.filter(t => t.id !== id)
    },

    // Invalidate caches
    invalidateCache() {
      this.templateCache = {}
      this.listCache = null
      this.allTemplates = []
      this.allTemplatesFetched = 0
    },

    invalidateTemplateCache(id: string) {
      delete this.templateCache[id]
    },

    // Setup realtime subscription
    ensureSubscribed() {
      if (this._subscribed) return

      subscribeToTemplates((data: any) => {
        const { action, record } = data

        switch (action) {
          case 'create':
            // Add to caches
            if (this.listCache && this.listCache.page === 1) {
              this.listCache.items = [record, ...this.listCache.items]
              this.listCache.totalItems++
            }
            this.allTemplates = [record, ...this.allTemplates]
            this.templateCache[record.id] = {
              data: record,
              timestamp: Date.now()
            }
            break

          case 'update':
            // Update in caches
            this.templateCache[record.id] = {
              data: record,
              timestamp: Date.now()
            }

            if (this.listCache) {
              this.listCache.items = this.listCache.items.map(t =>
                t.id === record.id ? record : t
              )
            }

            this.allTemplates = this.allTemplates.map(t =>
              t.id === record.id ? record : t
            )
            break

          case 'delete':
            // Remove from caches
            this.deleteTemplateFromCache(record.id)
            break
        }
      })

      this._subscribed = true
    },

    // Cleanup subscription
    unsubscribe() {
      if (this._subscribed) {
        unsubscribeToTemplates()
        this._subscribed = false
      }
    }
  }
})
