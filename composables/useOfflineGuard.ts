import { toast } from 'vue-sonner';

export function useOfflineGuard() {
  const { isOffline } = useNetwork();

  function requiresOnline(label: string): boolean {
    if (isOffline.value) {
      toast.error(`${label} requires an internet connection.`);
      return false;
    }
    return true;
  }

  return { isOffline, requiresOnline };
}
