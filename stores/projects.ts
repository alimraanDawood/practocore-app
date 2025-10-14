import { defineStore } from 'pinia';
import { getProjects, subscribeToProjects } from '~/services/projects';

// Cache duration in milliseconds (e.g., 1 minute)
const CACHE_TTL = 60 * 1000;

type ProjectsResult = any | null; // Matches services/projects.getProjects return shape

type SelectionState = {
  active: boolean;
  selected: any[];
};

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    result: null as ProjectsResult,
    loading: false as boolean,
    // filters
    query: '' as string,
    sort: 'Deadlines_via_project.date' as string,
    // pagination (basic; current UI uses 1,10)
    page: 1 as number,
    perPage: 10 as number,
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
  }),
  getters: {
    isStale(state) {
      if (!state.lastFetched) return true;
      // Re-fetch when filters changed or cache expired
      if (state._lastQuery !== state.query) return true;
      if (state._lastSort !== state.sort) return true;
      return Date.now() - state.lastFetched > CACHE_TTL;
    },
    totalItems: (state) => state.result?.totalItems ?? 0,
    items: (state) => state.result?.items ?? [],
  },
  actions: {
    async fetchProjects(force = false) {
      // Avoid redundant fetches if we have fresh data
      if (!force && this.result && !this.isStale) {
        return this.result;
      }
      this.loading = true;
      try {
        // Note: original page didn't apply sort server-side; we keep API shape but pass sort for future use.
        const res = await getProjects(this.page, this.perPage, {
          expand: '',
          sort: this.sort || '',
          filter: `name ~ '${this.query}'`,
        });
        this.result = res;
        this.lastFetched = Date.now();
        this._lastQuery = this.query;
        this._lastSort = this.sort;
        return res;
      } catch (e) {
        console.error(e);
        throw e;
      } finally {
        this.loading = false;
      }
    },
    ensureSubscribed() {
      if (this._subscribed) return;
      subscribeToProjects(async () => {
        // Soft refresh (do not block UI if we already have data)
        const hadData = !!this.result;
        if (!hadData) this.loading = true;
        try {
          const res = await getProjects(this.page, this.perPage, {
            expand: '',
            sort: this.sort || '',
            filter: `name ~ '${this.query}'`,
          });
          this.result = res;
          this.lastFetched = Date.now();
          this._lastQuery = this.query;
          this._lastSort = this.sort;
        } catch (e) {
          console.error(e);
        } finally {
          if (!hadData) this.loading = false;
        }
      });
      this._subscribed = true;
    },
    resetSelection() {
      this.selection = { active: false, selected: [] };
    },
    toggleSelectionFor(project: any) {
      const exists = this.selection.selected.find((p) => p.id === project.id);
      if (exists) {
        this.selection.selected = this.selection.selected.filter((p) => p.id !== project.id);
        if (this.selection.selected.length === 0) {
          this.selection.active = false;
        }
      } else {
        this.selection.selected.push(project);
      }
    },
    activateSelectionWith(project: any) {
      if (!this.selection.active) {
        this.selection.active = true;
        this.selection.selected.push(project);
      }
    },
  },
});
