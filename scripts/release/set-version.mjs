import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [version, androidVersionCode, iosBuildNumber = androidVersionCode] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '../..');

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  throw new Error('Usage: bun run version:sync -- <semver> <android-version-code> [ios-build-number]');
}
if (!/^\d+$/.test(androidVersionCode ?? '') || Number(androidVersionCode) < 1) {
  throw new Error('Android version code must be a positive integer');
}
if (!/^\d+$/.test(iosBuildNumber ?? '') || Number(iosBuildNumber) < 1) {
  throw new Error('iOS build number must be a positive integer');
}

const update = async (file, transform) => {
  const absolutePath = path.join(root, file);
  const original = await readFile(absolutePath, 'utf8');
  const updated = transform(original);
  if (updated === original) throw new Error(`No version metadata changed in ${file}`);
  await writeFile(absolutePath, updated);
};

await update('package.json', (source) => {
  const json = JSON.parse(source);
  json.version = version;
  return `${JSON.stringify(json, null, 2)}\n`;
});
await update('src-tauri/Cargo.toml', (source) => source.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`));
await update('src-tauri/tauri.conf.json', (source) => {
  const json = JSON.parse(source);
  json.version = version;
  return `${JSON.stringify(json, null, 2)}\n`;
});
await update('android/app/build.gradle', (source) =>
  source
    .replace(/versionCode\s+\d+/, `versionCode ${androidVersionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`),
);
await update('ios/App/App.xcodeproj/project.pbxproj', (source) =>
  source
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${iosBuildNumber};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`),
);

console.log(`Synchronized native version metadata to ${version}.`);
