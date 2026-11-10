/**
 * report.html: shows one report in its own browser tab.
 *
 * Opened by the "Playwright BDD" tab (see ReportViewer.openInNewTab). This page cannot call
 * Azure DevOps itself, so it asks its opener for the report zip and serves it from memory,
 * just like the tab does. Its own URL fragment remembers which page of the report is shown,
 * so reloading keeps the place as long as the opener is still open.
 */
import { loadArchive } from '../viewer/archive';
import { ReportHost } from '../viewer/host';
import type { PopupReport } from '../viewer/ui';

const status = document.getElementById('status')!;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const notice = document.getElementById('notice')!;

const state = new URLSearchParams(location.hash.slice(1));
let host: ReportHost | undefined;

function showStatus(text: string, kind: 'busy' | 'error'): void {
  status.textContent = text;
  status.dataset.kind = kind;
  status.hidden = false;
  frame.hidden = true;
}

function rememberPosition(): void {
  try {
    const href = frame.contentWindow?.location.href ?? '';
    const page = host?.pathOf(href);
    if (!page) return;
    const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
    history.replaceState(null, '', '#' + new URLSearchParams({ page, hash }).toString());
  } catch {
    // report navigated somewhere we cannot read; keep the last known position
  }
}

async function show({ data, name, runUrlTemplate }: PopupReport): Promise<void> {
  showStatus('Unpacking report…', 'busy');
  const archive = await loadArchive(data);
  document.title = `${name} · Playwright BDD`;
  host?.dispose();
  host = new ReportHost(archive, {
    runUrlTemplate,
    onNotice: (m) => {
      notice.querySelector('span')!.textContent = m;
      notice.hidden = false;
    },
  });
  const page = state.get('page');
  const target = page && archive.files.has(page) ? page : archive.entry;
  frame.src = host.lookup(target)! + (target === page ? state.get('hash') ?? '' : '');
  frame.hidden = false;
  status.hidden = true;
}

frame.addEventListener('load', () => {
  rememberPosition();
  try {
    frame.contentWindow?.addEventListener('hashchange', rememberPosition);
  } catch {
    // ignore
  }
});
notice.querySelector('button')!.addEventListener('click', () => (notice.hidden = true));

const opener = window.opener as Window | null;
if (!opener) {
  showStatus(
    'This page shows a report opened from the “Playwright BDD” tab of a pipeline run. ' +
      'Open the run in Azure DevOps and use “Open in new tab” again.',
    'error',
  );
} else {
  let received = false;
  window.addEventListener('message', (e) => {
    if (e.source !== opener || e.data?.type !== 'pbdd-report' || received) return;
    received = true;
    show(e.data as PopupReport).catch((err) =>
      showStatus(`Could not open the report. ${err instanceof Error ? err.message : String(err)}`, 'error'),
    );
  });
  showStatus('Loading report…', 'busy');
  opener.postMessage({ type: 'pbdd-ready' }, '*');
  setTimeout(() => {
    if (!received) {
      showStatus(
        'The Azure DevOps tab that opened this page is no longer available. ' +
          'Open the run’s “Playwright BDD” tab and use “Open in new tab” again.',
        'error',
      );
    }
  }, 15_000);
}
