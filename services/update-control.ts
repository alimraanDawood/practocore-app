import { reactive } from 'vue';
import { isDesktop } from '~/utils/isDesktop';

export type UpdateDecision = 'none' | 'silent_web_update' | 'prompt_restart' | 'prompt_native_update' | 'require_native_update' | 'backend_update_required' | 'incompatible' | 'rollback';

type NativeUpdateControlConfig = { url: string; channel: string };
type UpdateCheckResponse = { decision: UpdateDecision; releaseId?: string; version?: string; message?: string; minimumNativeVersion?: string };

export const updateControlState = reactive({
  configured: false,
  checking: false,
  decision: null as UpdateDecision | null,
  version: null as string | null,
  message: null as string | null,
  error: null as string | null,
});

function installationID(): string {
  const key = 'practocore-update-installation-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

async function nativeConfig(): Promise<NativeUpdateControlConfig | null> {
  if (!isDesktop()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  const config = await invoke<NativeUpdateControlConfig>('update_control_config');
  return config.url.startsWith('https://') || config.url.startsWith('http://127.0.0.1:') || config.url.startsWith('http://localhost:') ? config : null;
}

/** Consult policy before the official native updater. An unavailable service is
 * fail-open: the installed app and its official signed updater keep working. */
export async function checkUpdateControl(): Promise<UpdateCheckResponse | null> {
  const config = await nativeConfig();
  updateControlState.configured = Boolean(config);
  if (!config) return null;
  updateControlState.checking = true;
  updateControlState.error = null;
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const response = await fetch(`${config.url.replace(/\/$/, '')}/api/app-updates/check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'com.practocore.app', platform: navigator.platform.toLowerCase(), arch: 'unknown', deploymentMode: 'managed', nativeVersion: await getVersion(), webVersion: await getVersion(), backendApiVersion: '', enabledCapabilities: ['updates-v1'], channel: config.channel, deviceId: installationID() }),
    });
    if (!response.ok) throw new Error(`Update policy returned ${response.status}`);
    const policy = await response.json() as UpdateCheckResponse;
    updateControlState.decision = policy.decision;
    updateControlState.version = policy.version || null;
    updateControlState.message = policy.message || null;
    return policy;
  } catch (error) {
    updateControlState.error = error instanceof Error ? error.message : 'Unable to reach the update service.';
    return null;
  } finally { updateControlState.checking = false; }
}
