import type { ReportArchive } from './archive';
import { extensionOf, isHtml } from './mime';
import { shimScript } from './shim';

const TRACE_VIEWER_ORIGIN = 'https://trace.playwright.dev';
const VIRTUAL_ORIGIN = 'https://report.invalid';

export interface ReportHostEvents {
  /** Something the user should know about (e.g. popup blocked). */
  onNotice?(message: string): void;
  /**
   * A report page asked to show `path` in a new browser tab (target=_blank link, middle
   * click, window.open). Blob URLs created in a third-party iframe (the Azure DevOps tab)
   * cannot be opened in a new tab, so the embedding UI can take over. Without a handler
   * the blob URL is opened directly, which works in a first-party page.
   */
  onOpenPage?(path: string, hash: string): void;
}

/**
 * Serves the files of one in-memory report to the documents that display it.
 *
 * Report pages find the active host through `window.__pbddHost` on an ancestor or opener
 * window (see shim.ts), so only one host can be active per window at a time.
 */
export class ReportHost {
  private readonly urls = new Map<string, string>();
  private readonly globalApi: object;
  private disposed = false;

  constructor(
    readonly archive: ReportArchive,
    private readonly events: ReportHostEvents = {},
  ) {
    const w = window as any;
    if (w.__pbddHost) w.__pbddHost.dispose?.();
    this.globalApi = {
      lookup: (path: string) => this.lookup(path),
      openTrace: (paths: string[]) => this.openTrace(paths),
      openPage: (path: string, hash: string) => this.openPage(path, hash),
      pathOf: (url: string) => this.pathOf(url),
      dispose: () => this.dispose(),
    };
    w.__pbddHost = this.globalApi;
  }

  /** Blob URL of the report's entry page. */
  get entryUrl(): string {
    return this.lookup(this.archive.entry)!;
  }

  /** Archive path of a blob URL handed out by {@link lookup} (fragment ignored). */
  pathOf(url: string): string | undefined {
    const bare = url.split('#')[0];
    for (const [path, u] of this.urls) if (u === bare) return path;
    return undefined;
  }

  /** Show an archive file in a new browser tab. */
  openPage(path: string, hash = ''): void {
    if (this.events.onOpenPage) {
      this.events.onOpenPage(path, hash);
      return;
    }
    const url = this.lookup(path);
    if (url && !window.open(url + hash, '_blank')) {
      this.events.onNotice?.('The browser blocked the new tab. Allow pop-ups for this site and try again.');
    }
  }

  /** Blob URL for an archive path, created on first use. HTML and CSS are rewritten first. */
  lookup(path: string): string | null {
    if (this.disposed) return null;
    const cached = this.urls.get(path);
    if (cached) return cached;
    const blob = this.archive.files.get(path);
    if (!blob) return null;

    let body: Blob = blob;
    const text = this.archive.texts.get(path);
    if (text !== undefined) {
      if (isHtml(path)) body = new Blob([this.rewriteHtml(path, text)], { type: blob.type });
      else if (extensionOf(path) === 'css') body = new Blob([this.rewriteCss(path, text)], { type: blob.type });
    }
    const url = URL.createObjectURL(body);
    this.urls.set(path, url);
    return url;
  }

  /**
   * Opens Playwright traces in trace.playwright.dev. The trace viewer announces itself
   * with `{method: 'ready'}` to its opener and accepts `{method: 'load', params: {trace}}`,
   * so the trace goes straight from memory to the viewer — nothing is downloaded.
   */
  openTrace(paths: string[]): void {
    const traces = paths.map((p) => this.archive.files.get(p)).filter((b): b is Blob => !!b);
    if (traces.length === 0) {
      this.events.onNotice?.('The trace file is not part of the published report.');
      return;
    }
    const viewer = window.open(`${TRACE_VIEWER_ORIGIN}/`, '_blank');
    if (!viewer) {
      this.events.onNotice?.('The browser blocked the trace viewer window. Allow pop-ups for this site and try again.');
      return;
    }
    let delivered = false;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== viewer || e.data?.method !== 'ready') return;
      delivered = true;
      window.removeEventListener('message', onMessage);
      // The viewer loads one trace at a time; the first is the primary run.
      viewer.postMessage({ method: 'load', params: { trace: traces[0] } }, TRACE_VIEWER_ORIGIN);
    };
    window.addEventListener('message', onMessage);
    setTimeout(() => {
      window.removeEventListener('message', onMessage);
      if (!delivered && !viewer.closed) {
        this.events.onNotice?.('The trace viewer did not respond. Check that trace.playwright.dev is reachable from your network.');
      }
    }, 60_000);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    const w = window as any;
    if (w.__pbddHost === this.globalApi) delete w.__pbddHost;
  }

  private rewriteHtml(path: string, html: string): string {
    // Statically rewrite references to non-HTML files so that parser-inserted <script src>,
    // <link href> etc. load correctly. Links between pages are left to the shim, which
    // resolves them lazily (eager resolution would recurse on pages linking each other).
    const rewritten = html.replace(
      /(<[a-z][^<>]*?\s(?:src|href|poster|data)\s*=\s*)(["'])([^"'<>]*)\2/gi,
      (match, prefix: string, quote: string, value: string) => {
        const target = this.resolve(path, value.replace(/&amp;/g, '&'));
        if (!target || isHtml(target) || /(^|\/)trace\/index\.html$/i.test(target)) return match;
        const url = this.lookup(target);
        return url ? `${prefix}${quote}${url}${quote}` : match;
      },
    );
    return injectAtTop(rewritten, shimScript(path));
  }

  private rewriteCss(path: string, css: string): string {
    return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote: string, value: string) => {
      const target = this.resolve(path, value);
      const url = target && this.lookup(target);
      return url ? `url(${quote}${url}${quote})` : match;
    });
  }

  /** Archive path that `ref`, as written in the file at `from`, points to (or null). */
  private resolve(from: string, ref: string): string | null {
    if (!ref || ref.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(ref)) return null;
    try {
      const base = `${VIRTUAL_ORIGIN}/${from.split('/').map(encodeURIComponent).join('/')}`;
      const u = new URL(ref, base);
      const path = decodeURIComponent(u.pathname.slice(1));
      return this.archive.files.has(path) ? path : null;
    } catch {
      return null;
    }
  }
}

/** Insert `snippet` so it runs before any script of the page. */
function injectAtTop(html: string, snippet: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + snippet + html.slice(head.index + head[0].length);
  const htmlTag = /<html(\s[^>]*)?>/i.exec(html);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return html.slice(0, at) + `<head>${snippet}</head>` + html.slice(at);
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  const at = doctype ? doctype[0].length : 0;
  return html.slice(0, at) + snippet + html.slice(at);
}
