import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as tl from 'azure-pipelines-task-lib/task';
import JSZip from 'jszip';
import {
  ATTACHMENT_TYPE,
  MANIFEST_PATH,
  MANIFEST_VERSION,
  type ReportManifest,
} from '../../../src/shared/constants';

type IfMissing = 'warn' | 'error' | 'ignore';

async function run(): Promise<void> {
  const workDir = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
  const reportDir = path.resolve(workDir, tl.getInput('reportDir', true)!);
  const ifMissing = (tl.getInput('ifMissing') || 'warn') as IfMissing;

  if (!isDirectory(reportDir)) {
    return missing(ifMissing, `Report folder not found: ${reportDir}`);
  }

  const files = listFiles(reportDir);
  const entry = pickEntry(files, (tl.getInput('entryFile') || 'index.html').trim());
  if (!entry) {
    return missing(ifMissing, `No HTML file found in ${reportDir}`);
  }

  const job = tl.getVariable('System.JobDisplayName') || tl.getVariable('Agent.JobName') || undefined;
  const name = (tl.getInput('reportName') || '').trim() || job || 'Playwright BDD report';

  const zip = new JSZip();
  let totalBytes = 0;
  for (const rel of files) {
    const abs = path.join(reportDir, ...rel.split('/'));
    const size = fs.statSync(abs).size;
    totalBytes += size;
    // Media and archives are already compressed; deflating them again only burns CPU.
    zip.file(rel, fs.createReadStream(abs), {
      compression: isCompressed(rel) ? 'STORE' : 'DEFLATE',
    });
  }

  const manifest: ReportManifest = {
    version: MANIFEST_VERSION,
    name,
    entry,
    createdAt: new Date().toISOString(),
    fileCount: files.length,
    totalBytes,
    job,
  };
  zip.file(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const tempDir = tl.getVariable('Agent.TempDirectory') || fs.mkdtempSync(path.join(os.tmpdir(), 'pbdd-'));
  const attachmentName = `${sanitize(name)}.zip`;
  const zipPath = path.join(tempDir, `pbdd-${Date.now()}-${attachmentName}`);

  await pipeline(
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compressionOptions: { level: 6 } }),
    fs.createWriteStream(zipPath),
  );

  const zipSize = fs.statSync(zipPath).size;
  console.log(`Report folder : ${reportDir}`);
  console.log(`Entry file    : ${entry}`);
  console.log(`Files         : ${files.length} (${formatBytes(totalBytes)} → ${formatBytes(zipSize)} zipped)`);
  console.log(`Report name   : ${name}`);

  tl.addAttachment(ATTACHMENT_TYPE, attachmentName, zipPath);

  console.log('');
  console.log('Open this pipeline run and select the "Playwright BDD" tab to view the report.');
  tl.setResult(tl.TaskResult.Succeeded, `Published "${name}" (${files.length} files)`);
}

function missing(mode: IfMissing, message: string): void {
  switch (mode) {
    case 'error':
      tl.setResult(tl.TaskResult.Failed, message);
      return;
    case 'warn':
      tl.warning(message);
      tl.setResult(tl.TaskResult.SucceededWithIssues, message);
      return;
    default:
      console.log(message);
      tl.setResult(tl.TaskResult.Skipped, message);
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** All files under `root`, as sorted POSIX-style relative paths. */
function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${dirent.name}` : dirent.name;
      if (dirent.isDirectory()) walk(path.join(dir, dirent.name), rel);
      else if (dirent.isFile()) out.push(rel);
    }
  };
  walk(root, '');
  return out.sort();
}

function pickEntry(files: string[], requested: string): string | undefined {
  const wanted = requested.replace(/\\/g, '/').replace(/^\.?\//, '');
  if (wanted && files.includes(wanted)) return wanted;
  if (wanted) tl.warning(`Entry file "${wanted}" not found; falling back to the first HTML file.`);
  return (
    files.find((f) => !f.includes('/') && /\.html?$/i.test(f)) ?? files.find((f) => /\.html?$/i.test(f))
  );
}

function isCompressed(file: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|webm|mp4|zip|gz|woff2?)$/i.test(file);
}

/** Attachment names travel in URL paths; keep them to a safe, readable subset. */
function sanitize(name: string): string {
  const cleaned = name.replace(/[^\w .()-]+/g, '_').replace(/\s+/g, ' ').trim();
  return (cleaned || 'report').slice(0, 100);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

run().catch((err: unknown) => {
  tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
});
