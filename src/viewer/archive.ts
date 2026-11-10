import JSZip from 'jszip';
import { MANIFEST_PATH, type ReportManifest } from '../shared/constants';
import { extensionOf, isHtml, mimeType } from './mime';

/** A report unpacked in memory. Paths are archive-relative, POSIX style, without a leading slash. */
export interface ReportArchive {
  entry: string;
  manifest?: ReportManifest;
  /** Every file, as a typed Blob. */
  files: Map<string, Blob>;
  /** Decoded text of HTML and CSS files, which get rewritten before display. */
  texts: Map<string, string>;
}

const TEXT_EXTENSIONS = new Set(['html', 'htm', 'css']);

export async function loadArchive(data: ArrayBuffer | Blob): Promise<ReportArchive> {
  const zip = await JSZip.loadAsync(data);

  let manifest: ReportManifest | undefined;
  const manifestFile = zip.file(MANIFEST_PATH);
  if (manifestFile) {
    try {
      manifest = JSON.parse(await manifestFile.async('string'));
    } catch {
      // A broken manifest only costs us the display name; carry on.
    }
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith('.pbdd/'));
  const prefix = manifest ? '' : commonFolder(entries.map((f) => f.name));

  const files = new Map<string, Blob>();
  const texts = new Map<string, string>();
  await Promise.all(
    entries.map(async (f) => {
      const path = f.name.slice(prefix.length);
      const bytes = await f.async('uint8array');
      files.set(path, new Blob([bytes as BlobPart], { type: mimeType(path) }));
      if (TEXT_EXTENSIONS.has(extensionOf(path))) texts.set(path, new TextDecoder().decode(bytes));
    }),
  );

  const entry = pickEntry([...files.keys()], manifest?.entry);
  if (!entry) throw new Error('The report archive does not contain an HTML file.');
  return { entry, manifest, files, texts };
}

/**
 * Zips made by hand often wrap everything in one folder ("cucumber-report/…").
 * Strip it so relative links resolve the same way they did on disk.
 * Archives written by the task never have this, as long as the manifest is respected.
 */
function commonFolder(names: string[]): string {
  if (names.length === 0 || names.some((n) => !n.includes('/'))) return '';
  const first = names[0].slice(0, names[0].indexOf('/') + 1);
  return names.every((n) => n.startsWith(first)) ? first : '';
}

function pickEntry(paths: string[], preferred?: string): string | undefined {
  if (preferred && paths.includes(preferred)) return preferred;
  return (
    paths.find((p) => p === 'index.html') ??
    paths.find((p) => !p.includes('/') && isHtml(p)) ??
    paths.filter(isHtml).sort((a, b) => a.split('/').length - b.split('/').length)[0]
  );
}
