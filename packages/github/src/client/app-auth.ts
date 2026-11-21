import { createSign } from 'node:crypto';

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/**
 * The short-lived token a GitHub App uses to prove it is the app (RS256, at most ten minutes).
 * `iat` is set a minute in the past to allow for clock drift, as GitHub recommends.
 */
export function createAppJwt(options: {
  appId: string | number;
  /** The app's PEM private key. */
  privateKey: string;
  now?: () => number;
}): string {
  const now = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(options.appId) }),
  );
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(options.privateKey);
  return `${header}.${payload}.${base64url(signature)}`;
}
