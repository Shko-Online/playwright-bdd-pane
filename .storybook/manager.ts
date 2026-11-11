import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';
import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

/*
  Storybook's own UI follows the same "theme" global as the stories (see preview.ts):
  the system's light or dark mode by default ("auto"), or the mode picked in the toolbar
  or with the theme button in the demo's Azure DevOps top bar.
*/
const brand = {
  brandTitle: 'Playwright BDD Report for Azure DevOps',
  brandUrl: 'https://github.com/Shko-Online/playwright-bdd-pane',
  brandTarget: '_blank',
};
const themes = { light: create({ base: 'light', ...brand }), dark: create({ base: 'dark', ...brand }) };

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
let setting = 'auto';
const current = () => themes[setting === 'dark' || (setting === 'auto' && systemDark.matches) ? 'dark' : 'light'];

addons.setConfig({ theme: current() });

addons.register('playwright-bdd-pane/theme', (api) => {
  const apply = (globals?: Record<string, unknown>) => {
    setting = typeof globals?.theme === 'string' ? globals.theme : 'auto';
    api.setOptions({ theme: current() });
  };
  // SET_GLOBALS: the preview's initial globals (including ?globals= from the URL).
  api.on(SET_GLOBALS, ({ globals }) => apply(globals));
  api.on(GLOBALS_UPDATED, ({ globals }) => apply(globals));
  systemDark.addEventListener('change', () => api.setOptions({ theme: current() }));
});
