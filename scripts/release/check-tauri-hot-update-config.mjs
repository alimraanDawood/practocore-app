import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(process.argv[2] || 'src-tauri/tauri.conf.release.json', 'utf8'));
const hotUpdate = config.plugins?.['hot-update'];
if (!hotUpdate || typeof hotUpdate.enabled !== 'boolean') throw new Error('hot-update config must explicitly state enabled');
if (hotUpdate.enabled) {
  if (!/^https:\/\/[^?#]+$/.test(hotUpdate.manifestUrl || '')) throw new Error('hot-update manifestUrl must be a plain HTTPS URL');
  if (!Array.isArray(hotUpdate.pubkeys) || hotUpdate.pubkeys.length === 0 || hotUpdate.pubkeys.some((key) => typeof key !== 'string' || !key.trim())) throw new Error('hot-update requires one or more public keys');
}
console.log(`Tauri frontend OTA is ${hotUpdate.enabled ? 'enabled' : 'dark-shipped'}.`);
