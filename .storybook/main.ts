import type { StorybookConfig } from '@storybook/html-vite';
// @ts-expect-error: plain ES module without type declarations
import { traceViewerLogo, traceViewerVersion } from '../scripts/trace-viewer.mjs';

const config: StorybookConfig = {
  framework: '@storybook/html-vite',
  stories: ['../stories/**/*.stories.ts'],
  staticDirs: [
    // runs/20261110.1/*.zip: the reports published by the demo run.
    { from: '../stories/assets', to: '/' },
    // report.html + report.js, which "Open in new tab" opens next to the page
    // (built by `node scripts/build.mjs --web-only`, see the storybook scripts).
    { from: '../build/web', to: '/' },
    { from: '../images', to: '/images' },
  ],
  core: { disableTelemetry: true },
  // Same as scripts/build.mjs: the Trace Viewer's version and logo.
  viteFinal: (config) => ({
    ...config,
    define: {
      ...config.define,
      __TRACE_VIEWER_VERSION__: JSON.stringify(traceViewerVersion),
      __TRACE_VIEWER_LOGO__: JSON.stringify(traceViewerLogo),
    },
  }),
};

export default config;
