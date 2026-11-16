import { serviceHealth } from '@avero/contracts';

export function healthResponse(method: string | undefined, url: string | undefined) {
  if (url !== '/healthz') {
    return { status: 404, headers: {}, body: { error: 'Not found' } };
  }
  if (method !== 'GET') {
    return { status: 405, headers: { Allow: 'GET' }, body: { error: 'Method not allowed' } };
  }
  return { status: 200, headers: {}, body: serviceHealth('worker') };
}
