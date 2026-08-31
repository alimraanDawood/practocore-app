import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [version, metadataDirectory = 'updater-metadata', output = 'latest.json'] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/release/create-tauri-updater-manifest.mjs <semver> [metadata-directory] [output]');
}

const entries = await readdir(metadataDirectory, { withFileTypes: true });
const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
if (files.length === 0) throw new Error('No updater metadata files were provided');

const platforms = {};
for (const file of files) {
  const item = JSON.parse(await readFile(path.join(metadataDirectory, file.name), 'utf8'));
  if (!/^(darwin|windows|linux)-(aarch64|x86_64)$/.test(item.platform ?? '')) {
    throw new Error(`Invalid updater platform in ${file.name}`);
  }
  if (!/^https:\/\//.test(item.url ?? '') || typeof item.signature !== 'string' || item.signature.length === 0) {
    throw new Error(`Invalid updater metadata in ${file.name}`);
  }
  if (platforms[item.platform]) throw new Error(`Duplicate updater platform ${item.platform}`);
  platforms[item.platform] = { url: item.url, signature: item.signature };
}

for (const platform of ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64', 'linux-x86_64']) {
  if (!platforms[platform]) throw new Error(`Missing updater artifact for ${platform}`);
}

await writeFile(output, `${JSON.stringify({ version, pub_date: new Date().toISOString(), platforms }, null, 2)}\n`);
console.log(`Created ${output} for ${Object.keys(platforms).length} signed updater artifacts.`);
