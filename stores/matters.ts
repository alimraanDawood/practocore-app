import { defineStore } from 'pinia';
import { getMatters, getMatter, subscribeToMatters } from '~/services/matters';

// Cache duration in milliseconds - increased to 5 minutes for better performance
const CACHE_TTL = 5 * 60 * 1000;

type MattersResult = any | null; // Matches services/matters.getMatters return shape

type SelectionState = {
  active: boolean;
  selected: any[];
};

interface MatterCache {
  [id: string]: {
    data: any
    timestamp: number
  }
}

export const useMattersStore = defineStore('matters', {
  state: () => ({
    result: null as MattersResult,
    loading: false as boolean,
    backgroundRefreshing: false as boolean, // New: track background refresh

    // Individual matter cache
    matterCache: {} as MatterCache,

    // filters
    query: '' as string,
    sort: 'Deadlines_via_matter.date' as string,
    activeTab: 'all' as string,
    // pagination (basic; current UI uses 1,10)
    page: 1 as number,
    perPage: 40 as number,
    // selection for bulk actions
    selection: {
      active: false,
      selected: [] as any[],
    } as SelectionState,

    // housekeeping
    lastFetched: 0 as number,
    _subscribed: false as boolean,
    _lastQuery: '' as string,
    _lastSort: '' as string,
    _lastActiveTab: 'all' as string
  }),
  getters: {
    isStale(state) {
      if (!state.lastFetched) return true;
      // Re-fetch when filters changed or cache expired
      if (state._lastQuery !== state.query) return true;
      if (state._lastSort !== state.sort) return true;
      if (state._lastActiveTab !== state.activeTab) return true;

      return Date.now() - state.lastFetched > CACHE_TTL;
    },
    totalItems: (state) => state.result?.totalItems ?? 0,
    items: (state) => state.result?.items ?? [],

    // Get matter by ID from cache
    getMatterById: (state) => (id: string) => {
      const cached = state.matterCache[id]
      if (!cached) return null

      // Check if stale
      if (Date.now() - cached.timestamp > CACHE_TTL) {
        return null
      }

      return cached.data
    }
  },
  actions: {
    async fetchMatters(force = false, background = false) {
      // Avoid redundant fetches if we have fresh data
      if (!force && this.result && !this.isStale) {
        // If cache is getting old (>75% of TTL), refresh in background
        const cacheAge = Date.now() - this.lastFetched
        if (cacheAge > CACHE_TTL * 0.75 && !this.backgroundRefreshing) {
          this.fetchMattersInBackground()
        }
        return this.result;
      }

      // Use background flag to avoid blocking UI
      if (background) {
        this.backgroundRefreshing = true
      } else {
        this.loading = true;
      }

      try {
        // Note: original page didn't apply sort server-side; we keep API shape but pass sort for future use.
        let secondaryFilter  = '';
        switch(this.activeTab) {
          case 'all':
            secondaryFilter = '';
            break;
          case 'organisation':
            secondaryFilter = `personal = false`;
            break;
          case 'private':
            secondaryFilter = `personal = true`;
            break;
        }

        const res = await getMatters(this.page, this.perPage, {
          expand: '',
          sort: this.sort || '',
          filter: secondaryFilter.length === 0 ? `name ~ '${this.query}'` : `name ~ '${this.query}' && ${secondaryFilter}`,
        });

        this.result = res;
        this.lastFetched = Date.now();
        this._lastQuery = this.query;
        this._lastSort = this.sort;
        this._lastActiveTab = this.activeTab;

        // Update individual matter caches
        res.items?.forEach((matter: any) => {
          this.matterCache[matter.id] = {
            data: matter,
            timestamp: Date.now()
          }
        })

        return res;
      } catch (e) {
        console.error(e);
        throw e;
      } finally {
        if (background) {
          this.backgroundRefreshing = false
        } else {
          this.loading = false;
        }
      }
    },

    // Fetch in background without blocking UI
    async fetchMattersInBackground() {
      return this.fetchMatters(true, true)
    },

    // Update matter optimistically
    updateMatterOptimistic(id: string, updates: any) {
      // Update in result items
      if (this.result?.items) {
        this.result.items = this.result.items.map((m: any) =>
          m.id === id ? { ...m, ...updates } : m
        )
      }

      // Update in cache
      if (this.matterCache[id]) {
        this.matterCache[id].data = {
          ...this.matterCache[id].data,
          ...updates
        }
      }
    },

    // Add new matter optimistically
    addMatterOptimistic(matter: any) {
      if (this.result) {
        this.result.items = [matter, ...(this.result.items || [])]
        this.result.totalItems = (this.result.totalItems || 0) + 1
      }

      this.matterCache[matter.id] = {
        data: matter,
        timestamp: Date.now()
      }
    },

    // Remove matter from cache
    removeMatterFromCache(id: string) {
      if (this.result?.items) {
        this.result.items = this.result.items.filter((m: any) => m.id !== id)
        if (this.result.totalItems) {
          this.result.totalItems--
        }
      }

      delete this.matterCache[id]
    },
    ensureSubscribed() {
      if (this._subscribed) return;
      subscribeToMatters(async (data: any) => {
        const { action, record } = data

        const expandedRecord = await getMatter(record.id, {});
        // Handle subscription events optimistically
        switch (action) {
          case 'create':
            this.addMatterOptimistic(expandedRecord);
            break

          case 'update':
            this.updateMatterOptimistic(record.id, expandedRecord);
            break

          case 'delete':
            this.removeMatterFromCache(record.id)
            break

          default:
            // For unknown actions, do a background refresh
            this.fetchMattersInBackground()
        }
      });
      this._subscribed = true;
    },
    resetSelection() {
      this.selection = { active: false, selected: [] };
    },
    toggleSelectionFor(matter: any) {
      const exists = this.selection.selected.find((p) => p.id === matter.id);
      if (exists) {
        this.selection.selected = this.selection.selected.filter((p) => p.id !== matter.id);
        if (this.selection.selected.length === 0) {
          this.selection.active = false;
        }
      } else {
        this.selection.selected.push(matter);
      }
    },
    activateSelectionWith(matter: any) {
      if (!this.selection.active) {
        this.selection.active = true;
        this.selection.selected.push(matter);
      }
    },
  },
});
