import { serviceHealth } from '@avero/contracts';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(serviceHealth('web'), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
