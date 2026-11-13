// Builds and packages the extension into out/.
//   node scripts/package.mjs                      → public extension, version from vss-extension.json
//   node scripts/package.mjs --version 1.4.0      → stamps 1.4.0 into the manifest and task.json (releases)
//   node scripts/package.mjs --dev [--version …]  → private "-dev" variant (vss-extension.dev.json), with
//                                                   its own task, PublishPlaywrightBddReportDev (task.dev.json)
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

run(process.execPath, ['scripts/build.mjs', ...(version ? ['--version', version] : []), ...(dev ? ['--dev-task'] : [])]);

const overrides = {
  ...(dev ? JSON.parse(fs.readFileSync(path.join(root, 'vss-extension.dev.json'), 'utf8')) : {}),
  ...(version ? { version } : {}),
};

// The dev extension carries its own task (see task.dev.json), and its tab must list that task.
// tfx appends "contributions" from --override instead of replacing them, so the dev variant is
// packaged from a generated copy of the manifest, next to the original so relative paths hold.
let manifest = 'vss-extension.json';
if (dev) {
  const publicTask = JSON.parse(fs.readFileSync(path.join(root, 'tasks/PublishPlaywrightBddReport/task.json'), 'utf8'));
  const devTask = JSON.parse(fs.readFileSync(path.join(root, 'tasks/PublishPlaywrightBddReport/task.dev.json'), 'utf8'));
  const text = fs.readFileSync(path.join(root, manifest), 'utf8');
  if (!text.includes(publicTask.id)) throw new Error(`vss-extension.json does not mention the task id ${publicTask.id}.`);
  manifest = 'vss-extension.dev.generated.json';
  fs.writeFileSync(path.join(root, manifest), text.split(publicTask.id).join(devTask.id));
}

fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
try {
  run('npx', [
    '--no-install',
    'tfx',
    'extension',
    'create',
    '--manifest-globs',
    manifest,
    '--output-path',
    'out',
    '--override',
    JSON.stringify(overrides),
    '--no-prompt',
  ]);
} finally {
  if (dev) fs.rmSync(path.join(root, manifest), { force: true });
}
