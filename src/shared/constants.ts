/**
 * Contract between the pipeline task (writer) and the build results tab (reader).
 * Bump MANIFEST_VERSION if the archive layout changes in an incompatible way.
 */

/** Build attachment type used for published report archives. */
export const ATTACHMENT_TYPE = 'playwright-bdd-report';

/** Path, inside the archive, of the metadata file written by the task. */
export const MANIFEST_PATH = '.pbdd/manifest.json';

export const MANIFEST_VERSION = 1;

export interface ReportManifest {
  version: number;
  /** Display name of the report (task input `reportName`, or the job name). */
  name: string;
  /** Archive-relative path of the HTML file to open first. */
  entry: string;
  /** ISO timestamp of when the archive was created. */
  createdAt: string;
  fileCount: number;
  /** Total uncompressed size of the report files, in bytes. */
  totalBytes: number;
  job?: string;
}
