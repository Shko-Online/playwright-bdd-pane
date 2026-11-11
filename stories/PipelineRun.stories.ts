import type { Meta, StoryObj } from '@storybook/html-vite';
import { useGlobals } from 'storybook/preview-api';
import { createRunPage, type RunPageOptions } from './demo/run-page';

type Args = Omit<RunPageOptions, 'onToggleTheme'>;

/** The page on screen, kept across re-renders so a theme change keeps the open tab and report. */
let current: { key: string; page: HTMLElement } | undefined;
let setTheme: (theme: 'light' | 'dark') => void = () => {};

/**
 * Pipeline run #20261110.1 of the sample project, with the extension's **Playwright BDD**
 * tab running on the reports that run published. The rest of the page is a lightweight
 * stand-in for the Azure DevOps run page.
 */
const meta: Meta<Args> = {
  title: 'Demo/Pipeline run',
  render: (args) => {
    // The top bar's theme button sets the same global as the toolbar's theme switch.
    const [, updateGlobals] = useGlobals();
    setTheme = (theme) => updateGlobals({ theme });

    // Changing a global re-renders the story; returning the same element keeps its state.
    // A new page is built when the args change, or when the story is shown again (the
    // previous page was removed, and its viewer disposed, when another story was shown).
    const key = JSON.stringify(args);
    if (current?.key !== key || !current.page.isConnected) {
      current = {
        key,
        page: createRunPage({
          ...args,
          onToggleTheme: () => setTheme(document.documentElement.dataset.adoTheme === 'dark' ? 'light' : 'dark'),
        }),
      };
    }
    return current.page;
  },
  args: { tab: 'playwright-bdd', demoBanner: true },
  argTypes: {
    tab: { control: 'inline-radio', options: ['summary', 'tests', 'playwright-bdd'], description: 'Tab shown first' },
    demoBanner: { description: 'Show the strip that explains this page is a demo' },
  },
  // The page is the demo: keep the addon panel out of the way.
  parameters: { options: { showPanel: false } },
};

export default meta;

export const Run_20261110_1: StoryObj<Args> = { name: 'Run #20261110.1' };
