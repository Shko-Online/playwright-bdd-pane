import { loadArchive } from './archive';
import { ReportHost } from './host';

export interface ReportRef {
  /** Stable identifier, used to keep the selection across refreshes. */
  id: string;
  label: string;
}

/** Where reports come from: build attachments in Azure DevOps, local files in the dev harness. */
export interface ReportSource {
  list(): Promise<ReportRef[]>;
  download(ref: ReportRef, onProgress: (loaded: number, total?: number) => void): Promise<ArrayBuffer>;
  /** True while more reports may still be published (e.g. the run is in progress). */
  mayPublishMore?(): boolean;
}

export interface ViewerOptions {
  /** Called whenever the layout changes size (the tab uses it to resize its host iframe). */
  onLayout?(): void;
  pollIntervalMs?: number;
}

const FRAME_SANDBOX = [
  'allow-scripts',
  'allow-same-origin', // report pages must reach the ReportHost (and blob URLs) of this window
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-forms',
  'allow-modals',
  'allow-downloads',
].join(' ');

export class ReportViewer {
  private readonly picker: HTMLSelectElement;
  private readonly meta: HTMLElement;
  private readonly openButton: HTMLButtonElement;
  private readonly refreshButton: HTMLButtonElement;
  private readonly notice: HTMLElement;
  private readonly status: HTMLElement;
  private readonly frame: HTMLIFrameElement;

  private refs: ReportRef[] = [];
  private selectedId: string | undefined;
  private host: ReportHost | undefined;
  private loadToken = 0;
  private pollTimer: number | undefined;

  constructor(
    root: HTMLElement,
    private readonly source: ReportSource,
    private readonly options: ViewerOptions = {},
  ) {
    root.classList.add('pbdd');
    root.innerHTML = `
      <header class="pbdd-toolbar">
        <select class="pbdd-picker" aria-label="Report" hidden></select>
        <span class="pbdd-meta"></span>
        <span class="pbdd-actions">
          <button type="button" class="pbdd-button" data-action="open" disabled>Open in new tab</button>
          <button type="button" class="pbdd-button" data-action="refresh">Refresh</button>
        </span>
      </header>
      <div class="pbdd-notice" role="status" hidden>
        <span class="pbdd-notice-text"></span>
        <button type="button" class="pbdd-notice-close" aria-label="Dismiss">×</button>
      </div>
      <main class="pbdd-stage">
        <div class="pbdd-status"></div>
        <iframe class="pbdd-frame" title="Playwright BDD report" hidden></iframe>
      </main>`;

    this.picker = root.querySelector('.pbdd-picker')!;
    this.meta = root.querySelector('.pbdd-meta')!;
    this.openButton = root.querySelector('[data-action="open"]')!;
    this.refreshButton = root.querySelector('[data-action="refresh"]')!;
    this.notice = root.querySelector('.pbdd-notice')!;
    this.status = root.querySelector('.pbdd-status')!;
    this.frame = root.querySelector('.pbdd-frame')!;
    this.frame.setAttribute('sandbox', FRAME_SANDBOX);
    this.frame.setAttribute('allow', 'clipboard-write; fullscreen');

    this.picker.addEventListener('change', () => this.select(this.picker.value));
    this.openButton.addEventListener('click', () => this.openInNewTab());
    this.refreshButton.addEventListener('click', () => this.refresh());
    root.querySelector('.pbdd-notice-close')!.addEventListener('click', () => (this.notice.hidden = true));
  }

  /** (Re)load the list of reports and show the selected one. */
  async refresh(): Promise<void> {
    window.clearTimeout(this.pollTimer);
    this.setStatus('Looking for published reports…', 'busy');
    try {
      this.refs = await this.source.list();
    } catch (err) {
      this.setStatus(`Could not list the published reports. ${describe(err)}`, 'error');
      return;
    }

    if (this.refs.length === 0) {
      this.renderPicker();
      if (this.source.mayPublishMore?.()) {
        this.setStatus(
          'No report has been published yet. This page checks again automatically while the run is in progress.',
          'busy',
        );
        this.pollTimer = window.setTimeout(() => this.refresh(), this.options.pollIntervalMs ?? 15_000);
      } else {
        this.setStatus(
          'No Playwright BDD report was published for this run. Add the “Publish Playwright BDD report” task ' +
            '(with condition: succeededOrFailed()) after your test step.',
          'empty',
        );
      }
      return;
    }

    const keep = this.refs.find((r) => r.id === this.selectedId);
    this.renderPicker();
    await this.select((keep ?? this.refs[0]).id, true);

    if (this.source.mayPublishMore?.()) {
      // Pick up reports from jobs that have not finished yet, without disturbing the current view.
      this.pollTimer = window.setTimeout(() => this.pollForNewReports(), this.options.pollIntervalMs ?? 15_000);
    }
  }

  dispose(): void {
    window.clearTimeout(this.pollTimer);
    this.host?.dispose();
    this.host = undefined;
  }

  private async pollForNewReports(): Promise<void> {
    try {
      const refs = await this.source.list();
      if (refs.length !== this.refs.length) {
        this.refs = refs;
        this.renderPicker();
      }
    } catch {
      // transient; try again next time
    }
    if (this.source.mayPublishMore?.()) {
      this.pollTimer = window.setTimeout(() => this.pollForNewReports(), this.options.pollIntervalMs ?? 15_000);
    }
  }

  private renderPicker(): void {
    this.picker.replaceChildren(
      ...this.refs.map((r) => {
        const o = document.createElement('option');
        o.value = r.id;
        o.textContent = r.label;
        return o;
      }),
    );
    this.picker.hidden = this.refs.length < 2;
    if (this.selectedId) this.picker.value = this.selectedId;
  }

  private async select(id: string, force = false): Promise<void> {
    if (id === this.selectedId && this.host && !force) return;
    const ref = this.refs.find((r) => r.id === id);
    if (!ref) return;
    this.selectedId = id;
    this.picker.value = id;
    const token = ++this.loadToken;

    this.openButton.disabled = true;
    this.meta.textContent = this.refs.length < 2 ? ref.label : '';
    this.setStatus('Downloading report…', 'busy');

    try {
      const data = await this.source.download(ref, (loaded, total) => {
        if (token !== this.loadToken) return;
        const progress = total ? `${formatBytes(loaded)} of ${formatBytes(total)}` : formatBytes(loaded);
        this.setStatus(`Downloading report… ${progress}`, 'busy');
      });
      if (token !== this.loadToken) return;
      this.setStatus('Unpacking report…', 'busy');
      const archive = await loadArchive(data);
      if (token !== this.loadToken) return;

      this.host?.dispose();
      this.host = new ReportHost(archive, { onNotice: (m) => this.showNotice(m) });

      const m = archive.manifest;
      const details = [
        this.refs.length < 2 ? ref.label : '',
        `${archive.files.size} files`,
        m?.createdAt ? `published ${new Date(m.createdAt).toLocaleString()}` : '',
      ].filter(Boolean);
      this.meta.textContent = details.join(' · ');

      this.frame.src = this.host.entryUrl;
      this.frame.hidden = false;
      this.status.hidden = true;
      this.openButton.disabled = false;
      this.options.onLayout?.();
    } catch (err) {
      if (token !== this.loadToken) return;
      this.setStatus(`Could not open the report. ${describe(err)}`, 'error');
    }
  }

  private openInNewTab(): void {
    if (!this.host) return;
    let url = this.host.entryUrl;
    try {
      // Keep the page the user navigated to (e.g. a specific scenario).
      const current = this.frame.contentWindow?.location.href;
      if (current?.startsWith('blob:')) url = current;
    } catch {
      // not readable; fall back to the entry page
    }
    if (!window.open(url, '_blank')) {
      this.showNotice('The browser blocked the new tab. Allow pop-ups for this site and try again.');
    }
  }

  private setStatus(text: string, kind: 'busy' | 'empty' | 'error'): void {
    this.status.textContent = text;
    this.status.dataset.kind = kind;
    this.status.hidden = false;
    this.frame.hidden = true;
    if (kind !== 'busy') this.openButton.disabled = true;
    this.options.onLayout?.();
  }

  private showNotice(message: string): void {
    this.notice.querySelector('.pbdd-notice-text')!.textContent = message;
    this.notice.hidden = false;
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Read a fetch response body while reporting progress. */
export async function readWithProgress(
  response: Response,
  onProgress: (loaded: number, total?: number) => void,
): Promise<ArrayBuffer> {
  const total = Number(response.headers.get('content-length')) || undefined;
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out.buffer;
}
