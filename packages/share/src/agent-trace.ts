import { createHash } from 'node:crypto';
import type { RunRecord } from '@avero/contracts';
import { parseUnifiedDiff, type LineRange } from './patch.ts';

/**
 * Agent Trace output. Agent Trace is an open spec from Cursor that records which lines of code an
 * AI wrote (https://agent-trace.dev, RFC v0.1.0, January 2026). The types below follow its
 * published JSON Schema, https://agent-trace.dev/schemas/v1/trace-record.json, which sets
 * `additionalProperties: false` nearly everywhere, so anything Avero adds lives under `metadata`.
 *
 * What the spec needs, and where each value comes from:
 *
 * - `version`, `id`, `timestamp`, `files`: required. `id` must be a UUID, and the record has none,
 *   so one is derived from the run id: the same run always gives the same id.
 * - `files[].path`: relative to the repository root, from the diff. The recorder runs git in the
 *   folder it was pointed at, so this is correct when that folder is the repository root.
 * - `ranges`: 1-indexed lines in the file after the run, from the `+` lines of the diff.
 * - `contributor.type`: `ai` for added lines. A changed line is shown by git as removed and added,
 *   so a line an agent rewrote is `ai`, not `mixed`.
 * - `contributor.model_id`: the spec asks for `provider/model-name`. The record holds only the
 *   Cursor model id (for example `composer-2.5`), so it is used as is unless the caller passes the
 *   provider.
 * - `vcs.revision`: see below. It is left out when the run recorded no commit.
 * - `conversations[].url` and `related`: optional, and a local run has no URL, so they are omitted.
 * - `ranges[].content_hash`: optional, omitted.
 */

export type AgentTraceRange = { start_line: number; end_line: number };

export type AgentTrace = {
  version: string;
  id: string;
  timestamp: string;
  vcs?: { type: 'git'; revision: string };
  tool: { name: string; version: string };
  files: {
    path: string;
    conversations: {
      contributor: { type: 'ai'; model_id: string };
      ranges: AgentTraceRange[];
    }[];
  }[];
  metadata: Record<string, unknown>;
};

export type AgentTraceOptions = {
  /** Defaults to `avero`. */
  toolName?: string;
  /** The tool's version. The spec requires one. Defaults to `0.0.0`, the unreleased workspace. */
  version?: string;
  /** Prefixes the model id as `provider/model`, which is the form the spec asks for. */
  provider?: string;
  /**
   * The commit the line numbers refer to. See the note on `vcs.revision` in `toAgentTrace`.
   * Pass it after committing the run's changes.
   */
  revision?: string;
  /**
   * The spec version to declare. The published JSON Schema accepts `major.minor` only, while the
   * spec's own examples write `0.1.0`. Defaults to `0.1`, which the schema accepts.
   */
  specVersion?: string;
  /** Overrides the derived trace id. */
  id?: string;
};

/** A name-based UUID (version 5 layout) from the run, so exporting twice gives the same id. */
function deriveId(runId: string, head: string | undefined): string {
  const bytes = createHash('sha256')
    .update(`avero:agent-trace:${runId}:${head ?? ''}`)
    .digest();
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function toRanges(ranges: LineRange[]): AgentTraceRange[] {
  return ranges.map((range) => ({ start_line: range.start, end_line: range.end }));
}

/**
 * Turns a run's changes into an Agent Trace record of the lines the agent added.
 *
 * Caveat on `vcs.revision`: the spec says ranges refer to positions "at the recorded revision",
 * meaning the commit that contains the code. A run record only knows the commit the agent started
 * from (`started.git.head`), and the agent's edits are not committed yet. That commit is used as
 * the revision because it is the only one the record has, and it is also kept under
 * `metadata["dev.avero"].baseRevision`. The line numbers describe the files after the run, so they
 * match the base commit only for files the run did not change above the added lines. Pass
 * `options.revision` with the commit that holds the changes to make the trace exact.
 *
 * Only added lines are listed. A file that was only deleted, or a change with no added lines, has
 * nothing the agent wrote, so it is left out. A new file git did not track has no patch, so all of
 * its lines are listed, counted from the additions the recorder saw.
 */
export function toAgentTrace(record: RunRecord, options: AgentTraceOptions = {}): AgentTrace {
  const { started, finished } = record;
  const changes = finished?.changes;
  const head = started.git?.head;
  const modelId = options.provider ? `${options.provider}/${started.model}` : started.model;

  const files: AgentTrace['files'] = [];
  const diffs = parseUnifiedDiff(changes?.patch);
  const seen = new Set<string>();
  for (const diff of diffs) {
    seen.add(diff.path);
    if (diff.isDeleted || diff.added.length === 0) continue;
    files.push({
      path: diff.path,
      conversations: [
        { contributor: { type: 'ai', model_id: modelId }, ranges: toRanges(diff.added) },
      ],
    });
  }
  for (const file of changes?.files ?? []) {
    const isNewWithoutPatch = file.status === 'untracked' || file.status === 'added';
    if (seen.has(file.path) || !isNewWithoutPatch || !file.additions) continue;
    files.push({
      path: file.path,
      conversations: [
        {
          contributor: { type: 'ai', model_id: modelId },
          ranges: [{ start_line: 1, end_line: file.additions }],
        },
      ],
    });
  }

  const endMs = (finished?.t ?? record.events.at(-1)?.t ?? started.t) - started.t;
  const timestamp = new Date(Date.parse(started.startedAt) + Math.max(0, endMs)).toISOString();
  const revision = options.revision ?? head;

  return {
    version: options.specVersion ?? '0.1',
    id: options.id ?? deriveId(started.runId, head),
    timestamp,
    ...(revision ? { vcs: { type: 'git' as const, revision } } : {}),
    tool: { name: options.toolName ?? 'avero', version: options.version ?? '0.0.0' },
    files,
    metadata: {
      // Reverse-domain key, as the spec asks vendors to use. Avero's own details, not part of the spec.
      'dev.avero': {
        runId: started.runId,
        ...(head ? { baseRevision: head } : {}),
        ...(started.git ? { dirtyBeforeRun: started.git.dirtyBefore } : {}),
        runStatus: finished?.status ?? 'RUNNING',
        ...(changes?.patchTruncated ? { patchTruncated: true } : {}),
      },
    },
  };
}
