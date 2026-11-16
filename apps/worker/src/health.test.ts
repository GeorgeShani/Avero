import { serviceHealthSchema } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { healthResponse } from './health.ts';

describe('worker health route', () => {
  it('returns the shared health contract on GET', () => {
    const response = healthResponse('GET', '/healthz');
    expect(response.status).toBe(200);
    expect(serviceHealthSchema.parse(response.body)).toEqual({ service: 'worker', status: 'ok' });
  });

  it('returns 405 for unsupported methods and 404 for unknown routes', () => {
    expect(healthResponse('POST', '/healthz')).toMatchObject({
      status: 405,
      headers: { Allow: 'GET' },
    });
    expect(healthResponse('GET', '/missing').status).toBe(404);
  });
});
