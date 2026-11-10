const TYPES: Record<string, string> = {
  html: 'text/html;charset=utf-8',
  htm: 'text/html;charset=utf-8',
  css: 'text/css;charset=utf-8',
  js: 'text/javascript;charset=utf-8',
  mjs: 'text/javascript;charset=utf-8',
  json: 'application/json;charset=utf-8',
  webmanifest: 'application/manifest+json',
  map: 'application/json;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  log: 'text/plain;charset=utf-8',
  md: 'text/plain;charset=utf-8',
  xml: 'application/xml;charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  webm: 'video/webm',
  mp4: 'video/mp4',
  zip: 'application/zip',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  pdf: 'application/pdf',
};

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function mimeType(path: string): string {
  return TYPES[extensionOf(path)] ?? 'application/octet-stream';
}

export function isHtml(path: string): boolean {
  const ext = extensionOf(path);
  return ext === 'html' || ext === 'htm';
}
