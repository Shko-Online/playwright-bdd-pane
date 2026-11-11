/**
 * Report sources for the stories. The real tab reads build attachments through the Azure
 * DevOps REST API (src/tab/main.ts); here the same ReportViewer reads the run's report zips
 * from static files, or from fakes that reproduce the viewer's other states.
 */
import { readWithProgress, ReportViewer, type ReportRef, type ReportSource } from '../../src/viewer/ui';
import { run, type PublishedReport } from './run-data';

/** Folder with the run's report zips (see .storybook/main.ts staticDirs). */
const ASSETS = 'runs/20261110.1/';

/** Story id of the run page, used as the target of the Cucumber report's "Azure Pipelines" link. */
export const RUN_STORY_ID = 'demo-pipeline-run--run-20261110-1';

/** The run page of this demo, with `{id}` where the build id goes (see ReportSource.runUrlTemplate). */
export function demoRunUrlTemplate(): string {
  // Built by hand: URL would percent-encode the braces of the placeholder.
  return `${new URL('iframe.html', location.href).href}?id=${RUN_STORY_ID}&viewMode=story&buildId={id}`;
}

/** The reports published by run #20261110.1, served from static files. */
export class DemoRunSource implements ReportSource {
  constructor(private readonly reports: PublishedReport[] = run.reports) {}

  async list(): Promise<ReportRef[]> {
    return this.reports.map((r) => ({ id: r.file, label: r.name }));
  }

  async download(ref: ReportRef, onProgress: (loaded: number, total?: number) => void): Promise<ArrayBuffer> {
    const res = await fetch(new URL(ASSETS + ref.id, location.href));
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return readWithProgress(res, onProgress);
  }

  runUrlTemplate(): string {
    return demoRunUrlTemplate();
  }
}

/** A run that has published nothing (yet). */
export class EmptySource implements ReportSource {
  constructor(private readonly inProgress: boolean) {}
  async list(): Promise<ReportRef[]> {
    return [];
  }
  download(): Promise<ArrayBuffer> {
    throw new Error('nothing to download');
  }
  mayPublishMore(): boolean {
    return this.inProgress;
  }
}

/** The attachment list cannot be read, e.g. the user lacks access. */
export class FailingListSource implements ReportSource {
  async list(): Promise<ReportRef[]> {
    throw new Error('TF400813: The user is not authorized to access this resource.');
  }
  download(): Promise<ArrayBuffer> {
    throw new Error('unreachable');
  }
}

/** A large report on a slow connection: progress moves, the download never finishes. */
export class SlowDownloadSource implements ReportSource {
  async list(): Promise<ReportRef[]> {
    return [{ id: 'big', label: 'Cucumber report' }];
  }
  download(_ref: ReportRef, onProgress: (loaded: number, total?: number) => void): Promise<ArrayBuffer> {
    const total = 48 * 1024 * 1024;
    let loaded = 0;
    const tick = () => {
      loaded = Math.min(total * 0.9, loaded + 1.3 * 1024 * 1024);
      onProgress(loaded, total);
      if (loaded < total * 0.9) window.setTimeout(tick, 400);
    };
    tick();
    return new Promise(() => {});
  }
}

/** The attachment is not a report zip. */
export class BrokenArchiveSource implements ReportSource {
  async list(): Promise<ReportRef[]> {
    return [{ id: 'broken', label: 'Cucumber report' }];
  }
  async download(): Promise<ArrayBuffer> {
    return new TextEncoder().encode('<html>Sign in to continue</html>').buffer as ArrayBuffer;
  }
}

let mounted: ReportViewer | undefined;

/**
 * Creates the viewer in `root` and loads its reports. Storybook keeps one page for every
 * story, so the viewer of the previous story is disposed first.
 */
export function mountViewer(root: HTMLElement, source: ReportSource): ReportViewer {
  mounted?.dispose();
  mounted = new ReportViewer(root, source);
  void mounted.refresh();
  return mounted;
}
