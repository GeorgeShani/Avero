import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readDecision, readRun, readVerdict } from '@avero/run-store';
import { renderRunPage } from './page.ts';
import { redactForSharing } from './redact.ts';

export type ExportOptions = {
  /** The folder of run records. */
  dir: string;
  runId: string;
  /** When given, the page is also written to this file. */
  outFile?: string;
  /** Exact secret values to remove as well, for example the API key from the environment. */
  secrets?: readonly string[];
};

export type ExportResult = {
  /** One self-contained HTML document. */
  html: string;
  /** How many pieces of text the redaction pass replaced. */
  redactions: number;
  outFile?: string;
};

/**
 * Reads a run with its verdict and decision, runs the redaction pass over all three, and renders
 * one self-contained replay page. The record on disk is never changed.
 */
export async function exportRun(options: ExportOptions): Promise<ExportResult> {
  const [record, verdict, decision] = await Promise.all([
    readRun(options.dir, options.runId),
    readVerdict(options.dir, options.runId),
    readDecision(options.dir, options.runId),
  ]);
  const redacted = redactForSharing(record, {
    ...(verdict ? { verdict } : {}),
    ...(decision ? { decision } : {}),
    ...(options.secrets ? { secrets: options.secrets } : {}),
  });
  const html = renderRunPage(redacted.record, {
    verdict: redacted.verdict,
    decision: redacted.decision,
  });
  if (options.outFile) {
    await mkdir(dirname(options.outFile), { recursive: true });
    await writeFile(options.outFile, html, 'utf8');
  }
  return {
    html,
    redactions: redacted.redactions,
    ...(options.outFile ? { outFile: options.outFile } : {}),
  };
}
