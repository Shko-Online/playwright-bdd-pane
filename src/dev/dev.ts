/**
 * Local harness for the viewer. Serves the same ReportViewer as the Azure DevOps tab,
 * fed from zips in .fixtures/ (produced by running the real task) or a picked file.
 */
import { readWithProgress, ReportViewer, type ReportRef, type ReportSource } from '../viewer/ui';

class LocalSource implements ReportSource {
  private picked = new Map<string, File>();

  /** Pretend runs live in the Shko-Online org, so vstfs:///Build/Build/<id> links resolve. */
  runUrlTemplate(): string {
    return 'https://dev.azure.com/Shko-Online/Shko.Online/_build/results?buildId={id}';
  }

  addFile(file: File): ReportRef {
    this.picked.set(file.name, file);
    return { id: `file:${file.name}`, label: `${file.name} (local file)` };
  }

  async list(): Promise<ReportRef[]> {
    const names: string[] = await (await fetch('/fixtures/')).json();
    return [
      ...names.map((n) => ({ id: `fixture:${n}`, label: n.replace(/^pbdd-\d+-/, '').replace(/\.zip$/, '') })),
      ...[...this.picked.keys()].map((n) => ({ id: `file:${n}`, label: `${n} (local file)` })),
    ];
  }

  async download(ref: ReportRef, onProgress: (loaded: number, total?: number) => void): Promise<ArrayBuffer> {
    const [kind, name] = [ref.id.slice(0, ref.id.indexOf(':')), ref.id.slice(ref.id.indexOf(':') + 1)];
    if (kind === 'file') return this.picked.get(name)!.arrayBuffer();
    const res = await fetch(`/fixtures/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return readWithProgress(res, onProgress);
  }
}

const source = new LocalSource();
const viewer = new ReportViewer(document.getElementById('app')!, source);
void viewer.refresh();

document.getElementById('pick')!.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    source.addFile(file);
    void viewer.refresh();
  }
});

// Dev-only: lets the fake host page (host.html) press toolbar buttons inside this
// cross-origin frame, so popup behaviour can be tested in a partitioned iframe.
window.addEventListener('message', (e) => {
  if (e.data?.type === 'dev-click') (document.querySelector(e.data.selector) as HTMLElement | null)?.click();
  if (e.data?.type === 'dev-pick') {
    const picker = document.querySelector('.pbdd-picker') as HTMLSelectElement;
    picker.value = [...picker.options].find((o) => o.text.includes(e.data.label))?.value ?? picker.value;
    picker.dispatchEvent(new Event('change'));
  }
});
