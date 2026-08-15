/**
 * True when running inside the Tauri desktop shell.
 *
 * Detected via `__TAURI_INTERNALS__`, the global Tauri v2 injects into every
 * webview it hosts. The old `window.is_desktop` / `window.electronNotifications`
 * flags belonged to the removed Electron wrapper and are never set now, so the
 * desktop branch of services/push-notifications.ts was dead — this is the check
 * that replaces it.
 */
export function isDesktop(): boolean {
  return import.meta.client && typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
}
