import { checkForDesktopUpdate } from '~/services/desktop-updates';
import { isDesktop } from '~/utils/isDesktop';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export default defineNuxtPlugin(() => {
  if (!isDesktop()) return;

  // Avoid blocking initial app readiness. The updater has its own signature
  // checks and all failures remain non-blocking for the user's current work.
  window.setTimeout(() => { void checkForDesktopUpdate(); }, 15_000 + Math.floor(Math.random() * 15_000));
  window.setInterval(() => { void checkForDesktopUpdate(); }, CHECK_INTERVAL_MS);
});
