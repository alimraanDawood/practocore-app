import { ref, computed } from 'vue';
import { Capacitor } from '@capacitor/core';

const isOnline = ref(true);
const connectionType = ref<string>('unknown');
let initialized = false;

export function useNetwork() {
  if (!initialized) {
    initialized = true;

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/network').then(({ Network }) => {
        Network.getStatus().then((status) => {
          isOnline.value = status.connected;
          connectionType.value = status.connectionType;
        });

        Network.addListener('networkStatusChange', (status) => {
          isOnline.value = status.connected;
          connectionType.value = status.connectionType;
        });
      });
    } else {
      isOnline.value = navigator.onLine;
      window.addEventListener('online', () => { isOnline.value = true; });
      window.addEventListener('offline', () => { isOnline.value = false; });
    }
  }

  return {
    isOnline: readonly(isOnline),
    isOffline: computed(() => !isOnline.value),
    connectionType: readonly(connectionType),
  };
}
