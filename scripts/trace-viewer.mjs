// Copies the Playwright Trace Viewer into build/web/trace/.
//
// The viewer comes ready-built in the playwright-core npm package (lib/vite/traceViewer), the
// same files `npx playwright show-trace` and HTML reports serve. It is copied as published,
// together with the license and notices of playwright-core, except for its SVG logo: the
// Visual Studio Marketplace rejects packages that contain SVG files. The tab supplies the logo
// to the viewer page instead (traceViewerLogo, see src/viewer/trace.ts). Its pages use relative URLs, so it
// works from any folder, next to its service worker. Upgrade it by changing the version of
// playwright-core in package.json.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageDir = path.dirname(require.resolve('playwright-core/package.json'));

const viewer = path.join(packageDir, 'lib', 'vite', 'traceViewer');

/** Version of the bundled Trace Viewer (the playwright-core package it comes from). */
export const traceViewerVersion = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).version;

/** The viewer's logo (playwright-logo.svg), as a data: URL. */
export const traceViewerLogo =
  'data:image/svg+xml;base64,' + fs.readFileSync(path.join(viewer, 'playwright-logo.svg')).toString('base64');

export function buildTraceViewer(outdir) {
  if (!fs.existsSync(path.join(viewer, 'index.html')) || !fs.existsSync(path.join(viewer, 'sw.bundle.js'))) {
    throw new Error(`The Playwright Trace Viewer was not found in ${viewer}. Run npm install.`);
  }
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.cpSync(viewer, outdir, { recursive: true, filter: (src) => !src.toLowerCase().endsWith('.svg') });
  for (const file of ['LICENSE', 'NOTICE', 'ThirdPartyNotices.txt']) {
    fs.copyFileSync(path.join(packageDir, file), path.join(outdir, file));
  }
}
