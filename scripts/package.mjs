// Builds and packages the extension into out/.
//   node scripts/package.mjs                      → public extension, version from vss-extension.json
//   node scripts/package.mjs --version 1.4.0      → stamps 1.4.0 into the manifest and task.json (releases)
//   node scripts/package.mjs --dev [--version …]  → private "-dev" variant (vss-extension.dev.json)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const versionArg = args.indexOf('--version');
const version = versionArg >= 0 ? args[versionArg + 1] : undefined;

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });

run(process.execPath, ['scripts/build.mjs', ...(version ? ['--version', version] : [])]);

const overrides = {
  ...(dev ? JSON.parse(fs.readFileSync(path.join(root, 'vss-extension.dev.json'), 'utf8')) : {}),
  ...(version ? { version } : {}),
};
fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
run('npx', [
  '--no-install',
  'tfx',
  'extension',
  'create',
  '--manifest-globs',
  'vss-extension.json',
  '--output-path',
  'out',
  '--override',
  JSON.stringify(overrides),
  '--no-prompt',
]);
