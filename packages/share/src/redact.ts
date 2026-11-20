import type { Decision, RunFinished, RunRecord, Verdict } from '@avero/contracts';

/**
 * A safety net for sharing, not a guarantee. The recorder already scrubs the API key and the
 * workspace path; this pass runs again on export and removes common secret formats from every
 * string it can reach. It cannot know a secret it has no pattern for, so a person should still
 * read a file before sending it to someone.
 */

type Rule = {
  kind: string;
  pattern: RegExp;
  /** Builds the replacement. Return the match unchanged to leave it alone. */
  replace?: (match: string, ...groups: string[]) => string;
};

const mark = (kind: string) => `[REDACTED:${kind}]`;

const rules: Rule[] = [
  {
    kind: 'private-key',
    pattern:
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    // A key block that was cut off by a size limit still starts with its header.
    kind: 'private-key',
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----(?![\s\S]*-----END)[\s\S]*$/g,
  },
  { kind: 'cursor-key', pattern: /\bcrsr_[A-Za-z0-9_-]{16,}/g },
  { kind: 'api-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { kind: 'api-key', pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { kind: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/g },
  { kind: 'github-token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { kind: 'aws-key-id', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  {
    kind: 'bearer-token',
    pattern: /\b(Bearer\s+)([A-Za-z0-9._~+/=-]{8,})/gi,
    // Ordinary prose such as "Bearer authentication" has no digits and is short.
    replace: (match, prefix = '', token = '') =>
      token.length >= 24 || /\d/.test(token) ? `${prefix}${mark('bearer-token')}` : match,
  },
  {
    // .env style: KEY=value, where the key names a secret. Also matches inside a diff line.
    kind: 'env-value',
    pattern:
      /^([+\- ]?[ \t]*(?:export[ \t]+)?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY)[A-Z0-9_]*[ \t]*=[ \t]*)(?!\[REDACTED)(\S.*)$/gm,
    replace: (match, prefix = '', value = '') => {
      const bare = value.trim().replace(/^["']|["']$/g, '');
      // Placeholders and references are not secrets.
      if (bare === '' || /^(\$|<|process\.env|os\.environ|\{\{)/.test(bare)) return match;
      return `${prefix}${mark('env-value')}`;
    },
  },
  {
    // "password": "hunter2" inside a JSON string.
    kind: 'json-value',
    pattern:
      /("[A-Za-z0-9_]*(?:secret|password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|private[_-]?key)[A-Za-z0-9_]*"\s*:\s*")([^"\\\n]{4,})(")/gi,
    replace: (match, prefix = '', value = '', suffix = '') =>
      value.startsWith('[REDACTED') ? match : `${prefix}${mark('json-value')}${suffix}`,
  },
];

const sensitiveKey = /secret|password|passwd|api[_-]?key|private[_-]?key|authorization|token$/i;

export type RedactOptions = {
  /** Exact values to remove wherever they appear, for example the API key in the environment. */
  secrets?: readonly string[];
  verdict?: Verdict;
  decision?: Decision;
};

export type Redacted = {
  record: RunRecord;
  verdict?: Verdict;
  decision?: Decision;
  /** How many pieces of text were replaced, across the record, the verdict and the decision. */
  redactions: number;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scrubber(secrets: readonly string[]) {
  let count = 0;
  const literals = [...new Set(secrets.filter((secret) => secret.length >= 8))]
    // Longest first, so a secret that contains another is removed whole.
    .sort((a, b) => b.length - a.length)
    .map((secret) => new RegExp(escapeRegExp(secret), 'g'));

  const text = (input: string): string => {
    let out = input;
    for (const literal of literals) {
      out = out.replace(literal, () => {
        count += 1;
        return mark('secret');
      });
    }
    for (const rule of rules) {
      out = out.replace(rule.pattern, (match: string, ...args: unknown[]) => {
        const groups = args.filter((arg): arg is string => typeof arg === 'string');
        // The last string argument is the whole input when the rule has no groups.
        const captured = groups.slice(0, Math.max(0, groups.length - 1));
        const replaced = rule.replace ? rule.replace(match, ...captured) : mark(rule.kind);
        if (replaced !== match) count += 1;
        return replaced;
      });
    }
    return out;
  };

  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return text(value);
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === 'object' && value !== null) {
      const copy: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) {
        if (typeof inner === 'string' && inner !== '' && sensitiveKey.test(key)) {
          if (inner.startsWith('[REDACTED')) {
            copy[key] = inner;
          } else {
            count += 1;
            copy[key] = mark('field');
          }
        } else {
          copy[key] = walk(inner);
        }
      }
      return copy;
    }
    return value;
  };

  return { walk, count: () => count };
}

/**
 * Removes common secret formats from a copy of a run record and its review: Cursor `crsr_` keys,
 * `sk-` keys, Bearer tokens, GitHub tokens, AWS access key ids, private key blocks, `.env` style
 * lines whose name contains SECRET, TOKEN, PASSWORD or API_KEY, and the values of object fields
 * with names like `password` or `authorization`. Nothing is mutated.
 */
export function redactForSharing(record: RunRecord, options: RedactOptions = {}): Redacted {
  const scrub = scrubber(options.secrets ?? []);
  // `finished` is the same object as the last event, so redact the events and point at that copy.
  // Walking both would clean it twice and count it twice.
  const started = scrub.walk(record.started) as RunRecord['started'];
  const events = scrub.walk(record.events) as RunRecord['events'];
  const finished = events.find((event): event is RunFinished => event.type === 'run.finished');
  const copy: RunRecord = finished ? { started, events, finished } : { started, events };
  const verdict = options.verdict ? (scrub.walk(options.verdict) as Verdict) : undefined;
  const decision = options.decision ? (scrub.walk(options.decision) as Decision) : undefined;
  return {
    record: copy,
    ...(verdict ? { verdict } : {}),
    ...(decision ? { decision } : {}),
    redactions: scrub.count(),
  };
}
