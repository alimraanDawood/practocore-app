import { defineStore } from 'pinia';
import { getAllDeadlines, subscribeToDeadlines } from '~/services/matters';

// Cache duration in milliseconds (e.g., 1 minute)
const CACHE_TTL = 60 * 1000;

type Deadline = any;

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  color: string; // tailwind suffix e.g., 'accent-1'
  completed?: boolean;
};

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    deadlines: [] as Deadline[],
    loading: false as boolean,
    lastFetched: 0 as number,
    _subscribed: false as boolean,
    selectedDate: toISO(new Date()) as string,
    colorMap: {} as Record<string, number>, // deadlineId -> 0..3
  }),
  getters: {
    isStale(state) {
      if (!state.lastFetched) return true;
      return Date.now() - state.lastFetched > CACHE_TTL;
    },
    events(state): CalendarEvent[] {
      return state.deadlines.map((d) => {
        const idx = (this.accentIndexFor(d.id) % 4) + 1; // 1..4
        return {
          id: d.id,
          date: d.date,
          title: d.name,
          color: `accent-${idx}`,
          completed: d.completed,
        };
      });
    },
    deadlinesForDate: (state) => (iso: string) => {
      return state.deadlines.filter((d) => toISO(d.date) === iso);
    },
  },
  actions: {
    async fetchDeadlines(force = false) {
      if (!force && this.deadlines.length > 0 && !this.isStale) return this.deadlines;
      this.loading = true;
      try {
        const list = await getAllDeadlines({ sort: 'date' });
        this.deadlines = list;
        this.lastFetched = Date.now();
        return list;
      } finally {
        this.loading = false;
      }
    },
    ensureSubscribed() {
      if (this._subscribed) return;
      subscribeToDeadlines(async () => {
        const hadData = this.deadlines.length > 0;
        if (!hadData) this.loading = true;
        try {
          const list = await getAllDeadlines({ sort: 'date' });
          this.deadlines = list;
          this.lastFetched = Date.now();
        } finally {
          if (!hadData) this.loading = false;
        }
      });
      this._subscribed = true;
    },
    setSelectedDate(iso: string) {
      this.selectedDate = iso;
    },
    accentIndexFor(id: string) {
      if (this.colorMap[id] !== undefined) return this.colorMap[id];
      // Stable hash by summing char codes
      let sum = 0;
      for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) | 0;
      const idx = Math.abs(sum) % 4; // 0..3
      this.colorMap[id] = idx;
      return idx;
    },
  },
});

// Utilities (local copy to avoid cross-file imports)
function toISO(input: string | Date): string {
  const d = toDate(input);
  if (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

function toDate(input?: string | Date) {
  if (!input) return undefined;
  if (input instanceof Date) return new Date(input);
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}
