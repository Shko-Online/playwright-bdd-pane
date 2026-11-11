import type { Meta, StoryObj } from '@storybook/html-vite';
import type { ReportSource } from '../src/viewer/ui';
import { run } from './demo/run-data';
import {
  BrokenArchiveSource,
  DemoRunSource,
  EmptySource,
  FailingListSource,
  SlowDownloadSource,
  mountViewer,
} from './demo/sources';

/**
 * The content of the **Playwright BDD** tab (src/viewer/ui.ts) on its own, in each of its
 * states. In Azure DevOps it reads the run's build attachments; here it reads fixed sources.
 */
interface Args {
  source: () => ReportSource;
}

const meta: Meta<Args> = {
  title: 'Components/Report viewer',
  render: ({ source }) => {
    const root = document.createElement('div');
    root.style.height = '100vh';
    mountViewer(root, source());
    return root;
  },
  argTypes: { source: { table: { disable: true } } },
};

export default meta;
type Story = StoryObj<Args>;

/** Both reports of run #20261110.1; the picker switches between them. */
export const TwoReports: Story = { args: { source: () => new DemoRunSource() } };

/** With a single report, the picker is replaced by the report's name. */
export const OneReport: Story = { args: { source: () => new DemoRunSource([run.reports[0]]) } };

/** The run is still in progress: the tab checks again until a report appears. */
export const WaitingForReports: Story = { args: { source: () => new EmptySource(true) } };

/** The run finished without publishing a report. */
export const NoReports: Story = { args: { source: () => new EmptySource(false) } };

/** A large report being downloaded. */
export const Downloading: Story = { args: { source: () => new SlowDownloadSource() } };

/** The attachments could not be listed, for example because of missing permissions. */
export const CannotListReports: Story = { args: { source: () => new FailingListSource() } };

/** The attachment is not a report archive. */
export const NotAReport: Story = { args: { source: () => new BrokenArchiveSource() } };
