import { describe, expect, it } from 'vitest';
import {
  changeAssessmentInputSchema,
  serviceHealth,
  serviceHealthSchema,
  workspaceInputSchema,
} from './index.ts';

describe('service health', () => {
  it.each(['web', 'worker'] as const)('accepts the %s process response', (service) => {
    expect(serviceHealthSchema.parse(serviceHealth(service))).toEqual({ service, status: 'ok' });
  });

  it('rejects unsupported services and extra fields', () => {
    expect(serviceHealthSchema.safeParse({ service: 'db', status: 'ok' }).success).toBe(false);
    expect(serviceHealthSchema.safeParse({ ...serviceHealth('worker'), extra: true }).success).toBe(
      false,
    );
  });
});

describe('change assessment input', () => {
  it('requires from 1 to 100 changed paths', () => {
    expect(changeAssessmentInputSchema.safeParse({ paths: [] }).success).toBe(false);
    expect(
      changeAssessmentInputSchema.safeParse({ paths: Array(101).fill('package.json') }).success,
    ).toBe(false);
    expect(changeAssessmentInputSchema.safeParse({ paths: ['README.md'] }).success).toBe(true);
  });
});

describe('workspace input', () => {
  it('trims names and rejects blank names and client-supplied roles', () => {
    expect(workspaceInputSchema.parse({ name: ' Avero ' })).toEqual({ name: 'Avero' });
    expect(workspaceInputSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(workspaceInputSchema.safeParse({ name: 'A'.repeat(81) }).success).toBe(false);
    expect(workspaceInputSchema.safeParse({ name: 'Avero', role: 'owner' }).success).toBe(false);
  });
});
