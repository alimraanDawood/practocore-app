import { defineStore } from 'pinia';
import { getStatistics, subscribeToMatters } from '~/services/matters';
import { Capacitor } from '@capacitor/core';
import { db } from '~/lib/db';
import { pb } from '~/lib/pocketbase';

// Cache duration in milliseconds (e.g., 5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    statistics: null as any | null,
    loading: false as boolean,
    lastFetched: 0 as number,
    _subscribed: false as boolean,
    _offlineFallback: false as boolean,
  }),
  getters: {
    isStale: (state) => {
      if (!state.lastFetched) return true;
      return Date.now() - state.lastFetched > CACHE_TTL;
    },
  },
  actions: {
    async fetchStatistics(force = false) {
      // If we already have data and it's not stale, skip fetch
      if (!force && this.statistics && !this.isStale) {
        return this.statistics;
      }

      this.loading = true;
      try {
        const stats = await getStatistics();
        this.statistics = stats;
        this.lastFetched = Date.now();
        this._offlineFallback = false;
        if (Capacitor.isNativePlatform()) {
          const orgId = (pb as any).authStore?.record?.organisation || 'default';
          db.statistics.put({ id: orgId, data: stats, fetchedAt: Date.now() }).catch(() => {});
        }
        return stats;
      } catch (e) {
        if (Capacitor.isNativePlatform()) {
          const orgId = (pb as any).authStore?.record?.organisation || 'default';
          const cached = await db.statistics.get(orgId);
          if (cached) {
            this.statistics = cached.data;
            this._offlineFallback = true;
            return cached.data;
          }
        }
        throw e;
      } finally {
        this.loading = false;
      }
    },
    ensureSubscribed() {
      if (this._subscribed) return;
      if (!useNetwork().isOnline.value) return;
      // Subscribe to matters to refresh statistics when changes occur
      subscribeToMatters(async () => {
        // Soft refresh; do not block UI with loading state unless no data yet
        const hadData = !!this.statistics;
        if (!hadData) this.loading = true;
        try {
          const stats = await getStatistics();
          this.statistics = stats;
          this.lastFetched = Date.now();
        } finally {
          if (!hadData) this.loading = false;
        }
      });
      this._subscribed = true;
    },
    async init() {
      this.ensureSubscribed();
      await this.fetchStatistics(false);
    }
  }
});
