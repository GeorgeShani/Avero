import { describe, expect, it } from 'vitest';
import { redactedMark, scrubSecrets } from './scrub.ts';

// Fake credentials are assembled here so no real-looking one sits in the source.
const fakes: Record<string, string> = {
  'AWS key': ['AKIA', 'ABCDEFGHIJKLMNOP'].join(''),
  'GitHub token': ['ghp', '_', 'a'.repeat(36)].join(''),
  'fine-grained GitHub token': ['github', '_pat_', 'b'.repeat(60)].join(''),
  'Slack token': ['xoxb', '-', '1234567890-abcdefghij'].join(''),
  'Stripe live key': ['sk', '_live_', 'c'.repeat(20)].join(''),
  'provider key': ['sk', '-', 'd'.repeat(30)].join(''),
  'bearer token': ['Bearer ', 'e'.repeat(30)].join(''),
};

describe('scrubSecrets', () => {
  for (const [label, secret] of Object.entries(fakes)) {
    it(`removes a ${label}`, () => {
      const result = scrubSecrets(`failed with ${secret} in the request`);
      expect(result).not.toContain(secret);
      expect(result).toContain(redactedMark);
    });
  }

  it('removes a private key block', () => {
    const key = ['-----BEGIN ', 'PRIVATE KEY-----\nabcdef\n-----END ', 'PRIVATE KEY-----'].join('');
    expect(scrubSecrets(`key: ${key} done`)).toBe(`key: ${redactedMark} done`);
  });

  it('removes credentials in a URL and values of secret-named fields', () => {
    expect(scrubSecrets('clone https://user:hunter2hunter2@github.com/a/b.git')).toBe(
      `clone https://${redactedMark}@github.com/a/b.git`,
    );
    expect(scrubSecrets('{"password": "correct-horse-battery"}')).toContain(redactedMark);
    expect(scrubSecrets('token=abcdefghijkl')).toBe(`token=${redactedMark}`);
  });

  it('leaves ordinary text alone', () => {
    const text = 'Task 3 failed: the repository cannot be reached (exit code 128).';
    expect(scrubSecrets(text)).toBe(text);
  });
});
