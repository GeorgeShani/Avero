import { parseDiff } from './diff.ts';

type Rule = { id: string; label: string; pattern: RegExp };

const rules: readonly Rule[] = [
  {
    id: 'private-key',
    label: 'Private key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  },
  { id: 'aws-access-key', label: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  {
    id: 'github-pat',
    label: 'GitHub fine-grained token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
  },
  { id: 'slack-token', label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'stripe-live-key', label: 'Stripe live key', pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { id: 'api-key', label: 'Provider API key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  {
    id: 'assigned-secret',
    label: 'Secret assigned in code',
    pattern: /(?:api[_-]?key|secret|token|passw(?:or)?d)\s*[:=]\s*['"][^'"\s]{12,}['"]/i,
  },
];

/** A placeholder is not a leak: examples and templates are full of these. */
const placeholder = /(?:example|placeholder|changeme|your[_-]|xxxx|\*{3,}|<[^>]+>|\$\{)/i;

export type SecretFinding = {
  path: string;
  line: number;
  rule: string;
  label: string;
  /** The first characters only. The value itself is never returned. */
  preview: string;
};

/**
 * Looks for credentials in the lines a diff adds. Only added lines count: a secret that was
 * removed is not what this change introduces (it still needs rotating, which is for a person).
 * It matches known shapes, so a clean result means "none of these shapes", not "no secrets".
 */
export function scanSecrets(diff: string) {
  const { files, truncated } = parseDiff(diff);
  const findings: SecretFinding[] = [];
  for (const file of files) {
    if (/\.env\.example$/.test(file.path)) continue;
    for (const { line, text } of file.addedLines) {
      for (const rule of rules) {
        const match = rule.pattern.exec(text);
        if (!match || placeholder.test(match[0])) continue;
        findings.push({
          path: file.path,
          line,
          rule: rule.id,
          label: rule.label,
          preview: `${match[0].slice(0, 4)}…`,
        });
        break;
      }
    }
  }
  return { findings, scannedFiles: files.length, truncated };
}
