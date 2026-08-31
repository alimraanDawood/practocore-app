import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.argv[2] || 'src-tauri/tauri.conf.release.json';
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();

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

await writeFile(path.resolve(output), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(`Created signed updater configuration at ${output}.`);
