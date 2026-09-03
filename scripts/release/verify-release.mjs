import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const configCommand = "import config from './capacitor.config.ts'; console.log(JSON.stringify(config))";
const result = spawnSync(process.execPath, ['-e', configCommand], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, CAPACITOR_DEV_SERVER_URL: '' },
});

if (result.status !== 0) {
  throw new Error(`Could not resolve the production Capacitor config:\n${result.stderr || result.stdout}`);
}

const config = JSON.parse(result.stdout.trim());
const problems = [];

if (config.webDir !== 'dist') problems.push(`webDir must be dist (found ${config.webDir ?? 'missing'})`);
if (config.server?.url) problems.push(`production config must not contain server.url (${config.server.url})`);
if (config.server?.cleartext) problems.push('production config must not enable clear-text transport');
if (!existsSync(path.join(root, 'dist', 'index.html'))) problems.push('dist/index.html is missing');

// The app is ssr:false, so runtimeConfig.public is inlined into every generated
// HTML file at `nuxt generate` time. A loopback backend URL therefore ships
// baked into the artifact and the release talks to the user's own machine.
// v0.2.3 was published this way: a dev toggle committed into lib/pocketbase.ts
// silently removed the production fallback, and nothing checked the output.
const generatedHtml = ['index.html', '200.html', '404.html']
  .map((name) => path.join(root, 'dist', name))
  .filter((file) => existsSync(file));
const loopback = /(?:127\.0\.0\.1|localhost|0\.0\.0\.0)(?::\d+)?/;
for (const file of generatedHtml) {
  const match = readFileSync(file, 'utf8').match(loopback);
  if (match) problems.push(`dist/${path.basename(file)} contains a loopback URL (${match[0]}); set NUXT_PUBLIC_POCKETBASE_URL for the build`);
}

const androidManifest = readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const iosInfoPlist = readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');
if (/usesCleartextTraffic\s*=\s*["']true["']/i.test(androidManifest)) {
  problems.push('Android manifest must not enable usesCleartextTraffic');
}
if (/<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/i.test(iosInfoPlist)) {
  problems.push('iOS Info.plist must not enable NSAllowsArbitraryLoads');
}

if (problems.length > 0) {
  throw new Error(`Release packaging validation failed:\n- ${problems.join('\n- ')}`);
}

console.log('Release packaging verified: bundled dist/index.html; no Capacitor development server or clear-text transport.');
