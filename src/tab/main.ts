import * as SDK from 'azure-devops-extension-sdk';
import { getClient, type IProjectPageService } from 'azure-devops-extension-api';
import {
  BuildRestClient,
  BuildStatus,
  type Build,
  type IBuildPageDataService,
} from 'azure-devops-extension-api/Build';
import { ATTACHMENT_TYPE } from '../shared/constants';
import { readWithProgress, ReportViewer, type ReportRef, type ReportSource } from '../viewer/ui';
import { showBanner } from '../shared/banner';
import { luminance, setScheme } from '../viewer/theme';

// Service ids are const enums in the typings; spell them out so bundling stays simple.
const PROJECT_PAGE_SERVICE = 'ms.vss-tfs-web.tfs-page-data-service';
const BUILD_PAGE_DATA_SERVICE = 'ms.vss-build-web.build-page-data-service';

interface AttachmentRef extends ReportRef {
  href: string;
  timelineId?: string;
  recordId?: string;
  name: string;
}

/** Reports published by the task, read from the build's attachments. */
class BuildAttachmentSource implements ReportSource {
  private status: BuildStatus | undefined;
  private runUrl: string | undefined;
  private readonly client = getClient(BuildRestClient);

  constructor(
    private readonly project: string,
    private readonly buildId: number,
  ) {}

  runUrlTemplate(): string | undefined {
    return this.runUrl;
  }

  mayPublishMore(): boolean {
    return this.status !== undefined && this.status !== BuildStatus.Completed;
  }

  async list(): Promise<AttachmentRef[]> {
    const [attachments, build] = await Promise.all([
      this.client.getAttachments(this.project, this.buildId, ATTACHMENT_TYPE),
      this.client.getBuild(this.project, this.buildId),
    ]);
    this.status = build.status;
    const web: string | undefined = build._links?.web?.href;
    if (web && /[?&]buildId=\d+/.test(web)) this.runUrl = web.replace(/([?&]buildId=)\d+/, '$1{id}');

    const refs: AttachmentRef[] = attachments.map((a) => {
      const href: string = a._links?.self?.href ?? '';
      const ids = /\/builds\/\d+\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/attachments\//i.exec(href);
      return {
        id: href || a.name,
        href,
        name: a.name,
        label: a.name.replace(/\.zip$/i, ''),
        timelineId: ids?.[1],
        recordId: ids?.[2],
      };
    });

    // The same report name can come from several jobs (matrix, retries); tell them apart.
    const labels = refs.map((r) => r.label);
    if (new Set(labels).size !== labels.length) await this.addJobNames(refs);

    return refs.sort((a, b) => a.label.localeCompare(b.label));
  }

  async download(ref: ReportRef, onProgress: (loaded: number, total?: number) => void): Promise<ArrayBuffer> {
    const r = ref as AttachmentRef;
    try {
      const token = await SDK.getAccessToken();
      const response = await fetch(r.href, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' },
      });
      if (!response.ok) throw new Error(`The server answered ${response.status} ${response.statusText}.`);
      return await readWithProgress(response, onProgress);
    } catch (err) {
      // Fall back to the REST client (no progress) if a plain fetch is not possible here.
      if (!r.timelineId || !r.recordId) throw err;
      return this.client.getAttachment(this.project, this.buildId, r.timelineId, r.recordId, ATTACHMENT_TYPE, r.name);
    }
  }

  private async addJobNames(refs: AttachmentRef[]): Promise<void> {
    try {
      const timeline = await this.client.getBuildTimeline(this.project, this.buildId);
      const records = new Map(timeline.records.map((rec) => [rec.id, rec]));
      for (const ref of refs) {
        let rec = ref.recordId ? records.get(ref.recordId) : undefined;
        while (rec && rec.type !== 'Job' && rec.parentId) rec = records.get(rec.parentId);
        if (rec?.type === 'Job') {
          const attempt = rec.attempt > 1 ? ` (attempt ${rec.attempt})` : '';
          ref.label = `${ref.label} — ${rec.name}${attempt}`;
        }
      }
    } catch {
      // Labels stay ambiguous but usable.
    }
  }
}

/** The build-results-view contribution hands us the build either way, depending on the host. */
function currentBuild(): Promise<Pick<Build, 'id' | 'project'>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (build: any) => {
      if (settled || !build?.id) return;
      settled = true;
      resolve(build);
    };
    const config = SDK.getConfiguration();
    if (typeof config?.onBuildChanged === 'function') config.onBuildChanged(done);
    SDK.getService<IBuildPageDataService>(BUILD_PAGE_DATA_SERVICE)
      .then((svc) => done(svc.getBuildPageData()?.build))
      .catch(() => undefined);
    setTimeout(() => settled || reject(new Error('This page must be opened from a pipeline run.')), 15_000);
  });
}

async function main(): Promise<void> {
  showBanner('Playwright BDD');
  const root = document.getElementById('app')!;
  // The SDK applies the Azure DevOps theme as CSS variables, at start and whenever the user
  // switches theme. Reports follow it through the frame's color-scheme (see tab.css).
  window.addEventListener('themeApplied', followAzureDevOpsTheme);
  await SDK.init({ loaded: false, applyTheme: true });
  followAzureDevOpsTheme();

  try {
    const build = await currentBuild();
    const project =
      build.project?.id ??
      (await (await SDK.getService<IProjectPageService>(PROJECT_PAGE_SERVICE)).getProject())?.id;
    if (!project) throw new Error('Could not determine the current project.');

    const viewer = new ReportViewer(root, new BuildAttachmentSource(project, build.id), {
      onLayout: () => {
        // Build result tabs normally get a full-height frame. If the host collapsed us, ask for room.
        // Only the height: SDK.resize turns a missing width into the current body width, and the
        // host would pin the frame to it, so it stops following the window. NaN is sent as null,
        // the host writes "nullpx", the browser ignores that, and the width stays fluid.
        if (window.innerHeight < 400) SDK.resize(Number.NaN, 800);
      },
    });
    await SDK.notifyLoadSucceeded();
    await viewer.refresh();
  } catch (err) {
    root.textContent = err instanceof Error ? err.message : String(err);
    await SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
  }
}

/** Light or dark Azure DevOps theme, from the theme's page background colour. */
function followAzureDevOpsTheme(): void {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
  setScheme(background ? (luminance(background) < 0.5 ? 'dark' : 'light') : undefined);
}

void main();
