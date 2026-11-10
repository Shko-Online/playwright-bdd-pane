/**
 * Code injected at the top of every HTML page of a report.
 *
 * Report pages are displayed from `blob:` URLs, which cannot be used as a base for
 * relative URLs. Without help, `<img src="data/abc.png">`, `fetch('data/x.json')` or
 * `new URL('data/trace.zip', location.href)` all fail. The shim maps those relative
 * references to blob URLs served by the {@link ReportHost} living in a parent (or opener)
 * window, and routes Playwright trace links to the trace viewer.
 *
 * IMPORTANT: this function is serialised with `Function.prototype.toString()` and runs in
 * another document, so it must be completely self-contained: no imports, no references
 * to anything outside its own body.
 */
export function reportShim(currentPath: string): void {
  const w = window as any;
  if (w.__pbddShim) return;
  w.__pbddShim = true;

  const BASE_ORIGIN = 'https://report.invalid';
  const docBase = BASE_ORIGIN + '/' + currentPath.split('/').map(encodeURIComponent).join('/');
  const NativeURL: typeof URL = w.URL;
  const ATTRS = ['src', 'href', 'poster', 'data'];

  let cachedHost: any;
  const host = (): any => {
    if (cachedHost) return cachedHost;
    const candidates: any[] = [];
    try {
      for (let x: any = window; x; x = x.parent === x ? null : x.parent) candidates.push(x);
    } catch {
      // cross-origin ancestor: stop climbing
    }
    try {
      if (window.opener) candidates.push(window.opener);
    } catch {
      // ignore
    }
    for (const c of candidates) {
      try {
        if (c.__pbddHost) return (cachedHost = c.__pbddHost);
      } catch {
        // ignore
      }
    }
    return null;
  };

  type Target = { path: string; search: string; hash: string };
  const toArchivePath = (raw: unknown): Target | null => {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s || s[0] === '#' || /^(blob|data|javascript|mailto|about|tel):/i.test(s)) return null;
    let u: URL;
    try {
      u = new NativeURL(s, docBase);
    } catch {
      return null;
    }
    if (u.origin !== BASE_ORIGIN) return null;
    let path = u.pathname.slice(1);
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep the raw path
    }
    return { path, search: u.search, hash: u.hash };
  };

  const isTraceViewer = (path: string) => /(^|\/)trace\/index\.html$/i.test(path);

  const map = (raw: any): any => {
    // Non-web links (e.g. Cucumber's Azure Pipelines run link, vstfs:///Build/Build/123):
    // the host may know a browsable equivalent.
    if (typeof raw === 'string' && /^vstfs:/i.test(raw)) {
      const h = host();
      return (h && h.externalUrl && h.externalUrl(raw)) || raw;
    }
    const t = toArchivePath(raw);
    if (!t || isTraceViewer(t.path)) return raw;
    const h = host();
    const url: string | null = h ? h.lookup(t.path) : null;
    if (!url) return raw;
    return /\.html?$/i.test(t.path) ? url + t.hash : url;
  };

  const openTraces = (search: string): void => {
    const params = new URLSearchParams(search);
    const paths: string[] = [];
    params.getAll('trace').forEach((v) => {
      const t = toArchivePath(v);
      if (t) paths.push(t.path);
    });
    const h = host();
    if (h) h.openTrace(paths);
  };

  // new URL('data/x.png', location.href) throws for blob:/about: base URLs. Resolve
  // such URLs against a virtual base instead; `map` understands that base.
  const PatchedURL: any = function (this: unknown, url: string, base?: string | URL) {
    try {
      return base === undefined ? new NativeURL(url) : new NativeURL(url, base);
    } catch (e) {
      if (base === undefined || /^(blob|about):/i.test(String(base))) {
        try {
          return new NativeURL(url, docBase);
        } catch {
          // fall through to the original error
        }
      }
      throw e;
    }
  };
  PatchedURL.prototype = NativeURL.prototype;
  Object.setPrototypeOf(PatchedURL, NativeURL);
  w.URL = PatchedURL;

  const nativeFetch = w.fetch;
  if (nativeFetch) {
    w.fetch = function (this: unknown, input: any, init?: any) {
      if (typeof input === 'string' || input instanceof NativeURL) input = map(String(input));
      return nativeFetch.call(this, input, init);
    };
  }

  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: any, ...rest: any[]) {
    return (nativeXhrOpen as any).call(this, method, map(url), ...rest);
  } as any;

  const nativeWindowOpen = w.open;
  w.open = function (this: unknown, url?: any, ...rest: any[]) {
    const t = toArchivePath(url);
    if (t && isTraceViewer(t.path)) {
      openTraces(t.search);
      return null;
    }
    const h = host();
    if (t && h && h.lookup(t.path)) {
      h.openPage(t.path, t.hash);
      return null;
    }
    return nativeWindowOpen.call(this, map(url), ...rest);
  };

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if (typeof name === 'string' && ATTRS.indexOf(name.toLowerCase()) >= 0) value = map(value);
    return nativeSetAttribute.call(this, name, value);
  };

  const patchProperty = (ctor: any, prop: string) => {
    const proto = ctor && ctor.prototype;
    const desc = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, prop, {
      ...desc,
      set(this: unknown, v: any) {
        desc.set!.call(this, map(v));
      },
    });
  };
  patchProperty(w.HTMLImageElement, 'src');
  patchProperty(w.HTMLMediaElement, 'src');
  patchProperty(w.HTMLSourceElement, 'src');
  patchProperty(w.HTMLScriptElement, 'src');
  patchProperty(w.HTMLIFrameElement, 'src');
  patchProperty(w.HTMLEmbedElement, 'src');
  patchProperty(w.HTMLTrackElement, 'src');
  patchProperty(w.HTMLAnchorElement, 'href');
  patchProperty(w.HTMLLinkElement, 'href');
  patchProperty(w.HTMLObjectElement, 'data');
  patchProperty(w.HTMLVideoElement, 'poster');

  // Elements created by the HTML parser or via innerHTML bypass the setters above.
  const fix = (el: Element) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const m = map(v);
      if (m !== v) nativeSetAttribute.call(el, a, m);
    }
    // Links to other sites must not replace the report inside its frame (most sites, Azure
    // DevOps included, refuse to be framed): open them in a new tab instead.
    if (el.tagName === 'A' && !el.getAttribute('target')) {
      const href = el.getAttribute('href') || '';
      if (/^https?:/i.test(href) && !toArchivePath(href)) {
        nativeSetAttribute.call(el, 'target', '_blank');
        nativeSetAttribute.call(el, 'rel', 'noopener noreferrer');
      }
    }
  };
  const fixTree = (node: Node) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    fix(el);
    el.querySelectorAll('[src],[href],[poster],[data]').forEach(fix);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') fix(r.target as Element);
      else r.addedNodes.forEach(fixTree);
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });

  // Trace links point at the trace viewer bundled in the report (trace/index.html), which
  // needs a service worker and cannot run from a blob URL. Hand the trace to the host.
  const onClick = (e: MouseEvent) => {
    if (e.button > 1) return;
    const target = e.target as Element | null;
    const a = target && target.closest ? target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && /^vstfs:/i.test(href)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const t = toArchivePath(href);
    if (t && isTraceViewer(t.path)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openTraces(t.search);
      return;
    }
    // Links into the report that open a new tab: let the host decide how (see ReportHost.openPage).
    // `href` is usually already a blob URL by now, so look it up both ways.
    const newTab = a.getAttribute('target') === '_blank' || e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey;
    if (!newTab || a.hasAttribute('download')) return;
    const h = host();
    if (!h) return;
    const path = t && h.lookup(t.path) ? t.path : href && /^blob:/i.test(href) ? h.pathOf(href) : undefined;
    if (!path) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    h.openPage(path, href && href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '');
  };
  window.addEventListener('click', onClick, true);
  window.addEventListener('auxclick', onClick, true);
}

/** Source of a `<script>` element that runs the shim for the page at `currentPath`. */
export function shimScript(currentPath: string): string {
  const arg = JSON.stringify(currentPath).replace(/</g, '\\u003c');
  return `<script>(${reportShim.toString()})(${arg});</script>`;
}
