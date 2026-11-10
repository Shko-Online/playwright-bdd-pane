// Builds everything the .vsix needs into build/:
//   build/web/                         the build results tab (bundled)
//   build/tasks/PublishPlaywrightBddReport/  the pipeline task (bundled + production node_modules)
// `--dev` also emits the local harness (dev.html / host.html) with inline source maps.
import * as esbuild from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const out = path.join(root, 'build');
const web = path.join(out, 'web');
const taskSrc = path.join(root, 'tasks', 'PublishPlaywrightBddReport');
const taskOut = path.join(out, 'tasks', 'PublishPlaywrightBddReport');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(web, { recursive: true });
fs.mkdirSync(taskOut, { recursive: true });

const copy = (from, to) => fs.copyFileSync(path.join(root, from), to);

// --- build results tab -------------------------------------------------------
const browser = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !dev || process.argv.includes('--minify'),
  sourcemap: dev ? 'inline' : false,
  legalComments: 'eof',
  logLevel: 'warning',
};
await esbuild.build({ ...browser, entryPoints: [path.join(root, 'src/tab/main.ts')], outfile: path.join(web, 'tab.js') });
copy('src/tab/tab.html', path.join(web, 'tab.html'));
copy('src/tab/tab.css', path.join(web, 'tab.css'));

if (dev) {
  await esbuild.build({ ...browser, entryPoints: [path.join(root, 'src/dev/dev.ts')], outfile: path.join(web, 'dev.js') });
  copy('src/dev/dev.html', path.join(web, 'dev.html'));
  copy('src/dev/host.html', path.join(web, 'host.html'));
}

// --- pipeline task -----------------------------------------------------------
await esbuild.build({
  entryPoints: [path.join(taskSrc, 'src/index.ts')],
  outfile: path.join(taskOut, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node16',
  // task-lib loads its own resource files from its package folder at runtime, so it
  // ships as a regular dependency instead of being bundled.
  external: ['azure-pipelines-task-lib'],
  legalComments: 'eof',
  logLevel: 'warning',
});
for (const f of ['task.json', 'icon.png', 'package.json', 'package-lock.json']) {
  copy(path.join('tasks/PublishPlaywrightBddReport', f), path.join(taskOut, f));
}
// Don't let the npm_config_* settings of an outer `npm run` leak into this install.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k)));
execSync('npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error', { cwd: taskOut, stdio: 'inherit', env });

console.log(`Built ${path.relative(root, out)}/ (${dev ? 'dev' : 'production'})`);
