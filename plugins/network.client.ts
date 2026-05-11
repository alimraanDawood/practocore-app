import { pruneStaleCache } from '~/lib/db';

export default defineNuxtPlugin(() => {
  useNetwork();
  pruneStaleCache().catch(() => {});
});
