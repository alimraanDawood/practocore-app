import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const packageJson = JSON.parse(await read('package.json'));
const expectedVersion = packageJson.version;
const releaseTag = process.argv[2];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(expectedVersion)) {
  throw new Error(`package.json version is not a valid semantic version: ${expectedVersion}`);
}

if (releaseTag && releaseTag !== `v${expectedVersion}`) {
  throw new Error(`Release tag ${releaseTag} must match package.json version v${expectedVersion}`);
}

const cargoVersion = (await read('src-tauri/Cargo.toml')).match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const tauriVersion = JSON.parse(await read('src-tauri/tauri.conf.json')).version;
const android = await read('android/app/build.gradle');
const androidVersion = android.match(/versionName\s+"([^"]+)"/)?.[1];
const androidCode = android.match(/versionCode\s+(\d+)/)?.[1];
const xcodeProject = await read('ios/App/App.xcodeproj/project.pbxproj');
const iosVersions = [...xcodeProject.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
const iosBuildNumbers = [...xcodeProject.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => match[1]);

const mismatches = [
  ['Cargo', cargoVersion],
  ['Tauri config', tauriVersion],
  ['Android versionName', androidVersion],
  ...iosVersions.map((value, index) => [`iOS MARKETING_VERSION #${index + 1}`, value]),
].filter(([, value]) => value !== expectedVersion);

if (!androidCode || Number(androidCode) < 1 || iosBuildNumbers.length === 0 || iosBuildNumbers.some((value) => Number(value) < 1)) {
  throw new Error('Android versionCode and all iOS CURRENT_PROJECT_VERSION values must be positive integers');
}

if (mismatches.length > 0) {
  throw new Error(
    `Native version metadata does not match package.json (${expectedVersion}): ${mismatches
      .map(([name, value]) => `${name}=${value ?? 'missing'}`)
      .join(', ')}`,
  );
}

console.log(
  `Version metadata verified: ${expectedVersion} (Android versionCode ${androidCode}; iOS build ${iosBuildNumbers.join(', ')})`,
);
