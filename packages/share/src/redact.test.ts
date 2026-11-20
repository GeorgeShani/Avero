import { parseRunRecord } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { redactForSharing } from './redact.ts';
import { sampleDecision, sampleRecord, sampleVerdict } from './test-fixtures.ts';

// Made-up values in real formats. None of them is a working credential.
const cursorKey = `crsr_${'a1b2c3d4'.repeat(8)}`;
const openAiKey = 'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const anthropicKey = 'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-abcdef';
const githubToken = `ghp_${'A1b2C3d4E5'.repeat(4)}`;
const githubPat = `github_pat_11ABCDEFG0${'x9Y8z7W6v5'.repeat(4)}`;
const awsKeyId = 'AKIAIOSFODNN7EXAMPLE';
const bearer = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJl';
const privateKey = [
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIEowIBAAKCAQEAfakefakefakefakefakefakefakefakefakefake',
  'ZmFrZWZha2VmYWtlZmFrZWZha2U=',
  '-----END RSA PRIVATE KEY-----',
].join('\n');

function text(value: unknown): string {
  return JSON.stringify(value);
}

describe('redactForSharing', () => {
  it('removes each secret format from a string and counts it', () => {
    const record = sampleRecord({
      task: `Use ${cursorKey} and ${openAiKey} and ${anthropicKey}`,
      result: `Token ${githubToken}, ${githubPat}, id ${awsKeyId}, header ${bearer}`,
    });
    const { record: clean, redactions } = redactForSharing(record);
    const out = text(clean);
    for (const secret of [
      cursorKey,
      openAiKey,
      anthropicKey,
      githubToken,
      githubPat,
      awsKeyId,
      'eyJhbGciOiJIUzI1NiJ9',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(clean.started.task).toContain('[REDACTED:cursor-key]');
    expect(clean.finished?.result).toContain('Bearer [REDACTED:bearer-token]');
    expect(redactions).toBe(7);
  });

  it('removes a private key block, and one that was cut off', () => {
    const complete = redactForSharing(sampleRecord({ result: `Found:\n${privateKey}\nend` }));
    expect(complete.record.finished?.result).toBe('Found:\n[REDACTED:private-key]\nend');

    const cut = privateKey.split('\n').slice(0, 3).join('\n');
    const truncated = redactForSharing(sampleRecord({ result: `Found:\n${cut}` }));
    expect(truncated.record.finished?.result).toBe('Found:\n[REDACTED:private-key]');
  });

  it('redacts .env lines and diff lines whose name holds a secret word', () => {
    const env = [
      'DATABASE_URL=postgres://localhost/app',
      'STRIPE_SECRET_KEY=whsec_abcdef123456',
      'export GITHUB_TOKEN="abc123def456"',
      'MY_API_KEY = hunter2hunter2',
      'SESSION_PASSWORD=correct horse battery',
      'AUTH_TOKEN=${AUTH_TOKEN}',
      'API_KEY=',
    ].join('\n');
    const patch = [
      'diff --git a/.env b/.env',
      '@@ -0,0 +1 @@',
      '+OPENAI_API_KEY=abcdef0123456789',
    ].join('\n');
    const { record } = redactForSharing(sampleRecord({ result: env, patch }));
    expect(record.finished?.result).toBe(
      [
        'DATABASE_URL=postgres://localhost/app',
        'STRIPE_SECRET_KEY=[REDACTED:env-value]',
        'export GITHUB_TOKEN=[REDACTED:env-value]',
        'MY_API_KEY = [REDACTED:env-value]',
        'SESSION_PASSWORD=[REDACTED:env-value]',
        'AUTH_TOKEN=${AUTH_TOKEN}',
        'API_KEY=',
      ].join('\n'),
    );
    expect(record.finished?.changes?.patch).toContain('+OPENAI_API_KEY=[REDACTED:env-value]');
  });

  it('redacts secrets inside tool arguments and nested results, and sensitive field names', () => {
    const record = sampleRecord({
      toolArgs: {
        command: `curl -H "Authorization: ${bearer}" https://api.example.com`,
        env: { OPENAI_API_KEY: 'plain-value-without-a-format', PATH: '/usr/bin' },
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
        nested: [{ password: 'hunter2' }, { note: `see ${awsKeyId}` }],
      },
    });
    const { record: clean, redactions } = redactForSharing(record);
    const out = text(clean);
    expect(out).not.toContain('plain-value-without-a-format');
    expect(out).not.toContain('dXNlcjpwYXNz');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain(awsKeyId);
    expect(out).toContain('/usr/bin');
    // Each of the three tool events that carries these args is counted.
    expect(redactions).toBeGreaterThanOrEqual(5);
  });

  it('redacts JSON pairs inside a string', () => {
    const { record } = redactForSharing(
      sampleRecord({ result: 'Config: {"apiKey": "abcd1234efgh", "name": "demo"}' }),
    );
    expect(record.finished?.result).toBe(
      'Config: {"apiKey": "[REDACTED:json-value]", "name": "demo"}',
    );
  });

  it('leaves ordinary text and code alone', () => {
    const plain = [
      'Use Bearer authentication for the API.',
      'const maxTokens = 4000;',
      'The tokenizer counts tokens.',
      'sk-short',
      'ghp_tooshort',
    ].join('\n');
    const { record, redactions } = redactForSharing(sampleRecord({ result: plain }));
    expect(record.finished?.result).toBe(plain);
    expect(redactions).toBe(0);
  });

  it('removes exact secrets given by the caller, longest first, and ignores very short ones', () => {
    const { record, redactions } = redactForSharing(
      sampleRecord({ result: 'key=mysecretvalue-12345 and mysecretvalue and ab' }),
      { secrets: ['mysecretvalue', 'mysecretvalue-12345', 'ab'] },
    );
    expect(record.finished?.result).toBe('key=[REDACTED:secret] and [REDACTED:secret] and ab');
    expect(redactions).toBe(2);
  });

  it('redacts the verdict and the decision too', () => {
    const verdict = sampleVerdict({
      summary: `The agent printed ${openAiKey}`,
      checks: [
        {
          id: 'x',
          claim: 'No secrets',
          verdict: 'fail',
          evidence: `Saw ${githubToken} in the output`,
        },
      ],
    });
    const decision = sampleDecision({ note: `rotate ${awsKeyId} first` });
    const result = redactForSharing(sampleRecord(), { verdict, decision });
    expect(text(result.verdict)).not.toContain(openAiKey);
    expect(text(result.verdict)).not.toContain(githubToken);
    expect(result.decision?.note).toBe('rotate [REDACTED:aws-key-id] first');
    expect(result.redactions).toBe(3);
  });

  it('never changes its input', () => {
    const record = sampleRecord({ task: `Use ${cursorKey}` });
    const before = text(record);
    const verdict = sampleVerdict({ summary: openAiKey });
    const verdictBefore = text(verdict);
    redactForSharing(record, { verdict });
    expect(text(record)).toBe(before);
    expect(text(verdict)).toBe(verdictBefore);
  });

  it('keeps the record valid, and a second pass finds nothing more', () => {
    const record = sampleRecord({
      task: `Use ${cursorKey}`,
      result: `${bearer}\nSECRET_TOKEN=abc12345`,
    });
    const first = redactForSharing(record);
    const lines = [first.record.started, ...first.record.events].map((event) =>
      JSON.stringify(event),
    );
    expect(() => parseRunRecord(lines.join('\n'))).not.toThrow();
    const second = redactForSharing(first.record);
    expect(second.redactions).toBe(0);
    expect(text(second.record)).toBe(text(first.record));
  });
});
