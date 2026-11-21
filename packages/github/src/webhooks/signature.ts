import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Checks GitHub's `X-Hub-Signature-256` header against the raw request body. It compares in
 * constant time, accepts only the `sha256=` form, and says no to a missing header or an empty
 * secret instead of throwing, so an unsigned request is simply refused.
 *
 * The body must be the exact bytes GitHub sent: parse it as JSON only after this returns true.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Uint8Array,
  header: string | null | undefined,
): boolean {
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  const given = header.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(given, 'hex'));
}

/** The header value GitHub would send, for tests and for local tools that replay a delivery. */
export function signWebhookBody(secret: string, rawBody: string | Uint8Array): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}
