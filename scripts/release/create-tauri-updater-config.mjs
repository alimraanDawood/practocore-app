import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.argv[2] || 'src-tauri/tauri.conf.release.json';
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();
const hotUpdateEnabled = process.env.TAURI_HOT_UPDATE_ENABLED === 'true';
const hotUpdatePublicKey = process.env.TAURI_HOT_UPDATE_PUBLIC_KEY?.trim();
const hotUpdateManifestUrl = process.env.TAURI_HOT_UPDATE_MANIFEST_URL?.trim();

if (!publicKey) throw new Error('TAURI_UPDATER_PUBLIC_KEY is required for a signed desktop release');
if (!repository || !/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY must be an owner/repository value');

const config = {
  bundle: { createUpdaterArtifacts: true },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: [`https://github.com/${repository}/releases/latest/download/latest.json`],
      windows: { installMode: 'passive' },
    },
  },
};

// This POC has an independent minisign trust anchor from the official Tauri
// binary updater. The URL and keys are compiled into the signed native shell;
// web code can never select an update source. Dark shipping remains the safe
// default until every Phase 4 gate has an explicit architecture approval.
config.plugins['hot-update'] = hotUpdateEnabled
  ? (() => {
      if (!hotUpdatePublicKey || !hotUpdateManifestUrl?.startsWith('https://')) {
        throw new Error('TAURI_HOT_UPDATE_PUBLIC_KEY and HTTPS TAURI_HOT_UPDATE_MANIFEST_URL are required when enabling frontend OTA');
      }
      return { enabled: true, manifestUrl: hotUpdateManifestUrl, pubkeys: hotUpdatePublicKey.split(',').map((key) => key.trim()).filter(Boolean) };
    })()
  : { enabled: false };

await writeFile(path.resolve(output), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(`Created signed updater configuration at ${output}.`);
