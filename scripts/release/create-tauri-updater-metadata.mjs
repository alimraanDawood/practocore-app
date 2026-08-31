import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [platform, asset, signatureFile, tag, outputDirectory = 'updater-metadata'] = process.argv.slice(2);
const repository = process.env.GITHUB_REPOSITORY?.trim();

if (!/^(darwin|windows|linux)-(aarch64|x86_64)$/.test(platform ?? '')) throw new Error('Invalid updater platform');
if (!asset || !signatureFile || !tag || !repository) throw new Error('Usage: <platform> <asset> <signature-file> <tag> [output-directory]');
const signature = (await readFile(signatureFile, 'utf8')).trim();
if (!signature) throw new Error(`Signature file is empty: ${signatureFile}`);

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, `${platform}.json`),
  `${JSON.stringify({
    platform,
    url: `https://github.com/${repository}/releases/download/${tag}/${asset}`,
    signature,
  })}\n`,
);
