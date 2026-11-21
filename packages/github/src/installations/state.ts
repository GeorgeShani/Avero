import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const payloadSchema = z.object({
  w: z.uuid(),
  u: z.string().min(1).max(200),
  exp: z.number().int(),
});

const maxAgeMs = 10 * 60 * 1000;

function mac(secret: string, body: string): Buffer {
  return createHmac('sha256', secret).update(body).digest();
}

/**
 * The `state` value sent to GitHub when a person starts installing the app for a workspace. It
 * says which workspace and which signed-in person started it, and expires after ten minutes. When
 * GitHub sends the person back, only a state signed here, for the same person, is believed:
 * otherwise anyone could attach an installation to someone else's workspace.
 */
export function signInstallState(
  secret: string,
  input: { workspaceId: string; userId: string; now?: () => number },
): string {
  const body = Buffer.from(
    JSON.stringify({
      w: input.workspaceId,
      u: input.userId,
      exp: (input.now?.() ?? Date.now()) + maxAgeMs,
    }),
  ).toString('base64url');
  return `${body}.${mac(secret, body).toString('base64url')}`;
}

/** The workspace a valid, unexpired state was issued for, or undefined. */
export function verifyInstallState(
  secret: string,
  state: string,
  expected: { userId: string; now?: () => number },
): { workspaceId: string } | undefined {
  if (!secret) return undefined;
  const [body, signature, extra] = state.split('.');
  if (!body || !signature || extra !== undefined) return undefined;
  const given = Buffer.from(signature, 'base64url');
  const wanted = mac(secret, body);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return undefined;
  let parsed;
  try {
    parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  } catch {
    return undefined;
  }
  if (!parsed.success) return undefined;
  if (parsed.data.exp < (expected.now?.() ?? Date.now())) return undefined;
  if (parsed.data.u !== expected.userId) return undefined;
  return { workspaceId: parsed.data.w };
}
