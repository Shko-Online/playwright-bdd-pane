import type { Meta, StoryObj } from '@storybook/html-vite';
import { createRunPage, type RunPageOptions } from './demo/run-page';

/**
 * Pipeline run #20261110.1 of the sample project, with the extension's **Playwright BDD**
 * tab running on the reports that run published. The rest of the page is a lightweight
 * stand-in for the Azure DevOps run page.
 */
const meta: Meta<RunPageOptions> = {
  title: 'Demo/Pipeline run',
  render: (args) => createRunPage(args),
  args: { tab: 'playwright-bdd', demoBanner: true },
  // The page is the demo: keep the addon panel out of the way.
  parameters: { options: { showPanel: false } },
  argTypes: {
    tab: { control: 'inline-radio', options: ['summary', 'tests', 'playwright-bdd'], description: 'Tab shown first' },
    demoBanner: { description: 'Show the strip that explains this page is a demo' },
  },
};

export default meta;

export const Run_20261110_1: StoryObj<RunPageOptions> = { name: 'Run #20261110.1' };
