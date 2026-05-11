import { watch } from 'vue';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useOfflineSync() {
  const { isOnline } = useNetwork();
  const mattersStore = useMattersStore();
  const calendarStore = useCalendarStore();
  const dashboardStore = useDashboardStore();
  const templatesStore = useTemplatesStore();

  async function syncAll() {
    await Promise.allSettled([
      mattersStore.fetchMatters(true),
      calendarStore.fetchDeadlines(true),
      dashboardStore.fetchStatistics(true),
      templatesStore.fetchAllTemplates(true),
    ]);
  }

  watch(isOnline, (online, wasOnline) => {
    if (online && !wasOnline) {
      syncAll();
    }
  });

  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && isOnline.value) {
        syncAll();
      }
    });
  }
}
