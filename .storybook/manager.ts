import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Playwright BDD Report for Azure DevOps',
    brandUrl: 'https://github.com/Shko-Online/playwright-bdd-pane',
    brandTarget: '_blank',
  }),
});
