import type { StorybookConfig } from '@storybook/html-vite';

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
};

export default config;
