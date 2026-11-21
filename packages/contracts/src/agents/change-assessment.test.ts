import { describe, expect, it } from 'vitest';
import { changeAssessmentInputSchema } from './change-assessment.ts';

describe('change assessment input', () => {
  it('requires from 1 to 100 changed paths', () => {
    expect(changeAssessmentInputSchema.safeParse({ paths: [] }).success).toBe(false);
    expect(
      changeAssessmentInputSchema.safeParse({ paths: Array(101).fill('package.json') }).success,
    ).toBe(false);
    expect(changeAssessmentInputSchema.safeParse({ paths: ['README.md'] }).success).toBe(true);
  });
});
