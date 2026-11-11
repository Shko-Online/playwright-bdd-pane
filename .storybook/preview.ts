import type { Preview } from '@storybook/html-vite';
import '../src/tab/tab.css';
import '../stories/demo/run-page.css';

type Theme = 'auto' | 'light' | 'dark';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
let theme: Theme = 'auto';

/** Azure DevOps themes the extension frame; here the run page and the frame share :root. */
function applyTheme(next: Theme): void {
  theme = next;
  const dark = theme === 'dark' || (theme === 'auto' && systemDark.matches);
  document.documentElement.dataset.adoTheme = dark ? 'dark' : 'light';
}
systemDark.addEventListener('change', () => applyTheme(theme));

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Demo', 'Components'] } },
  },
  globalTypes: {
    theme: {
      description: 'Azure DevOps theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'auto', title: 'Follow system' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'auto' },
  decorators: [
    (story, context) => {
      applyTheme(context.globals.theme as Theme);
      return story();
    },
  ],
};

export default preview;
