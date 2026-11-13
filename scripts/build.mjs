// Builds everything the .vsix needs into build/:
//   build/web/                         the build results tab (bundled)
//   build/web/trace/                   the Playwright Trace Viewer, from playwright-core (see scripts/trace-viewer.mjs)
//   build/tasks/PublishPlaywrightBddReport/  the pipeline task (bundled + production node_modules)
// `--dev` also emits the local harness (dev.html / host.html) with inline source maps.
// `--version x.y.z` stamps that version into the packaged task.json (used by releases).
// `--dev-task` gives the packaged task the identity of the private "-dev" extension
// (tasks/PublishPlaywrightBddReport/task.dev.json), so it can be installed next to the public one.
// `--web-only` builds just build/web/ (Storybook serves report.html from it).
import * as esbuild from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTraceViewer, traceViewerLogo, traceViewerVersion } from './trace-viewer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const webOnly = process.argv.includes('--web-only');
const devTask = process.argv.includes('--dev-task');
const versionArg = process.argv.indexOf('--version');
const version = versionArg > 0 ? process.argv[versionArg + 1] : undefined;
if (version !== undefined && !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`--version must look like 1.2.3, got "${version}"`);
}
const out = path.join(root, 'build');
const web = path.join(out, 'web');
const taskSrc = path.join(root, 'tasks', 'PublishPlaywrightBddReport');
const taskOut = path.join(out, 'tasks', 'PublishPlaywrightBddReport');

fs.rmSync(webOnly ? web : out, { recursive: true, force: true });
fs.mkdirSync(web, { recursive: true });

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
  // The Trace Viewer's version, for its license notice (src/viewer/upsell.ts), and its logo,
  // which the tab hands to the viewer page (src/viewer/trace.ts).
  define: {
    __TRACE_VIEWER_VERSION__: JSON.stringify(traceViewerVersion),
    __TRACE_VIEWER_LOGO__: JSON.stringify(traceViewerLogo),
  },
};
await esbuild.build({ ...browser, entryPoints: [path.join(root, 'src/tab/main.ts')], outfile: path.join(web, 'tab.js') });
await esbuild.build({ ...browser, entryPoints: [path.join(root, 'src/tab/report.ts')], outfile: path.join(web, 'report.js') });
copy('src/tab/tab.html', path.join(web, 'tab.html'));
copy('src/tab/report.html', path.join(web, 'report.html'));
copy('src/tab/tab.css', path.join(web, 'tab.css'));
buildTraceViewer(path.join(web, 'trace'));

if (dev) {
  await esbuild.build({ ...browser, entryPoints: [path.join(root, 'src/dev/dev.ts')], outfile: path.join(web, 'dev.js') });
  copy('src/dev/dev.html', path.join(web, 'dev.html'));
  copy('src/dev/host.html', path.join(web, 'host.html'));
}

if (webOnly) {
  console.log(`Built ${path.relative(root, web)}/`);
  process.exit(0);
}

// --- pipeline task -----------------------------------------------------------
fs.mkdirSync(taskOut, { recursive: true });
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
if (version || devTask) {
  const taskJson = path.join(taskOut, 'task.json');
  let task = JSON.parse(fs.readFileSync(taskJson, 'utf8'));
  if (version) {
    // Agents cache tasks by version, so every release must carry a new task version too.
    const [Major, Minor, Patch] = version.split('.').map(Number);
    task.version = { Major, Minor, Patch };
  }
  if (devTask) task = { ...task, ...JSON.parse(fs.readFileSync(path.join(taskSrc, 'task.dev.json'), 'utf8')) };
  fs.writeFileSync(taskJson, JSON.stringify(task, null, 2) + '\n');
}
// Don't let the npm_config_* settings of an outer `npm run` leak into this install.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k)));
execSync('npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error', { cwd: taskOut, stdio: 'inherit', env });

console.log(`Built ${path.relative(root, out)}/ (${dev ? 'dev' : 'production'}${version ? `, v${version}` : ''})`);
