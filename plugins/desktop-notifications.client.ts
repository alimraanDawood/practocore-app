import { isDesktop } from '~/utils/isDesktop';
import { initDesktopNotifications } from '~/services/desktop-notifications';

/**
 * Boots the Tauri desktop notification bridge. The bridge itself watches the
 * authStore and pushes the token to the Rust background listener on every
 * change, so this only needs to start it once. No-op on web and mobile.
 */
export default defineNuxtPlugin(() => {
  if (!isDesktop()) return;
  setTimeout(() => { void initDesktopNotifications(); }, 500);
});
