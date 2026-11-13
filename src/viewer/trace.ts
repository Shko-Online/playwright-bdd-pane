/**
 * Shows Playwright traces with the Trace Viewer that ships with the extension (build/web/trace/,
 * copied from the playwright-core npm package by scripts/trace-viewer.mjs).
 *
 * The viewer runs a service worker that serves the trace and its snapshots, so it is loaded
 * from the extension's own files, never from a blob: URL. It announces itself to its parent
 * (or opener) with `{method: 'ready'}` and accepts `{method: 'load', params: {trace}}`, where
 * `trace` is the zip as a Blob: the trace goes from memory to the viewer, and never leaves
 * the browser.
 */
const VIEWER_PATH = 'trace/index.html';

/** The viewer's logo as a data: URL, set at build time (scripts/trace-viewer.mjs). */
declare const __TRACE_VIEWER_LOGO__: string;
const LOGO_FILE = 'playwright-logo.svg';

/** How long the viewer may take to start before we suggest opening it in a new tab. */
const START_TIMEOUT_MS = 20_000;

/** Path of the trace viewer page, next to the page this runs in. */
function viewerUrl(): string {
  return new URL(VIEWER_PATH, location.href).href;
}

/**
 * Hands `trace` to the viewer in `viewer()` each time it says it is ready (again, after a
 * reload). Returns a function that stops listening.
 */
function deliverTrace(viewer: () => Window | null | undefined, trace: Blob, onDelivered?: () => void): () => void {
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin || !e.source || e.source !== viewer() || e.data?.method !== 'ready') return;
    const target = e.source as Window;
    showLogo(target);
    target.postMessage({ method: 'load', params: { trace } }, location.origin);
    onDelivered?.();
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/**
 * The Visual Studio Marketplace does not accept SVG files in extensions, so the viewer's logo
 * (playwright-logo.svg) is not packaged with it. Point the viewer page's references to it at
 * the copy built into this script instead. The viewer's files stay as published.
 */
function showLogo(viewer: Window): void {
  let doc: Document;
  try {
    doc = viewer.document;
  } catch {
    return; // not reachable: the logo stays missing, nothing else is affected
  }
  const fix = () => {
    doc.querySelectorAll<HTMLImageElement>(`img[src$="${LOGO_FILE}"]`).forEach((img) => {
      img.src = __TRACE_VIEWER_LOGO__;
    });
    doc.querySelectorAll<HTMLLinkElement>(`link[rel~="icon"][href$="${LOGO_FILE}"]`).forEach((link) => {
      link.href = __TRACE_VIEWER_LOGO__;
    });
  };
  fix();
  // The viewer renders with React and may draw the header again.
  new MutationObserver(fix).observe(doc.documentElement, { childList: true, subtree: true });
}

/** Opens `trace` in the trace viewer, in a new browser tab. */
export function openTraceInNewTab(trace: Blob, onNotice?: (message: string) => void): void {
  const viewer = window.open(viewerUrl(), '_blank');
  if (!viewer) {
    onNotice?.('The browser blocked the new tab. Allow pop-ups for this site and try again.');
    return;
  }
  const stop = deliverTrace(() => viewer, trace);
  const watch = window.setInterval(() => {
    if (!viewer.closed) return;
    window.clearInterval(watch);
    stop();
  }, 5_000);
}

/**
 * The trace viewer, in a panel that covers the report. The report stays loaded underneath,
 * so "Back to report" returns to the same place.
 */
export class TracePanel {
  private readonly element: HTMLElement;
  private readonly status: HTMLElement;
  private frame: HTMLIFrameElement | undefined;
  private trace: Blob | undefined;
  private stopDelivery: (() => void) | undefined;
  private startTimer: number | undefined;

  constructor(
    private readonly stage: HTMLElement,
    private readonly onNotice: (message: string) => void,
  ) {
    this.element = document.createElement('section');
    this.element.className = 'pbdd-trace';
    this.element.setAttribute('aria-label', 'Playwright trace');
    this.element.hidden = true;
    this.element.innerHTML = `
      <div class="pbdd-trace-bar">
        <button type="button" class="pbdd-button" data-action="back">← Back to report</button>
        <span class="pbdd-meta">Trace</span>
        <span class="pbdd-actions">
          <button type="button" class="pbdd-button" data-action="trace-new-tab">Open trace in new tab</button>
        </span>
      </div>
      <div class="pbdd-status" hidden></div>`;
    this.status = this.element.querySelector('.pbdd-status')!;
    this.element.querySelector('[data-action="back"]')!.addEventListener('click', () => this.close());
    this.element.querySelector('[data-action="trace-new-tab"]')!.addEventListener('click', () => {
      if (this.trace) openTraceInNewTab(this.trace, this.onNotice);
    });
    stage.append(this.element);
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  open(trace: Blob): void {
    this.close();
    this.trace = trace;

    const frame = document.createElement('iframe');
    frame.className = 'pbdd-frame pbdd-trace-frame';
    frame.title = 'Playwright Trace Viewer';
    frame.setAttribute('allow', 'clipboard-write; fullscreen');
    this.frame = frame;
    this.stopDelivery = deliverTrace(
      () => frame.contentWindow,
      trace,
      () => {
        window.clearTimeout(this.startTimer);
        this.status.hidden = true;
      },
    );
    // The viewer only says it is ready once its service worker runs. Browsers that do not
    // allow service workers in embedded pages (some privacy settings do) never get there.
    this.startTimer = window.setTimeout(() => {
      this.status.textContent =
        'The trace viewer did not start. Your browser may not allow it inside this page. ' +
        'Use “Open trace in new tab” instead.';
      this.status.dataset.kind = 'error';
      this.status.hidden = false;
    }, START_TIMEOUT_MS);
    frame.src = viewerUrl();
    this.element.append(frame);

    this.setReportInert(true);
    this.element.hidden = false;
    (this.element.querySelector('[data-action="back"]') as HTMLElement).focus();
  }

  close(): void {
    window.clearTimeout(this.startTimer);
    this.stopDelivery?.();
    this.stopDelivery = undefined;
    this.frame?.remove();
    this.frame = undefined;
    this.trace = undefined;
    this.status.hidden = true;
    if (this.element.hidden) return;
    this.element.hidden = true;
    this.setReportInert(false);
  }

  /** Keeps keyboard focus and screen readers out of the report while the trace covers it. */
  private setReportInert(inert: boolean): void {
    for (const el of Array.from(this.stage.children)) {
      if (el !== this.element) (el as HTMLElement).inert = inert;
    }
  }
}
