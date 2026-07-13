import { describe, it, expect } from 'vitest';
import { parseSuiteRef } from '../../src/core/suiteRef';

describe('parseSuiteRef', () => {
  it('parses teamId/slug', () => {
    expect(parseSuiteRef('1/onboarding-pack', undefined)).toEqual({ teamId: 1, slug: 'onboarding-pack' });
  });
  it('falls back to default teamId for bare slug', () => {
    expect(parseSuiteRef('onboarding-pack', 7)).toEqual({ teamId: 7, slug: 'onboarding-pack' });
  });
  it('rejects bare slug without default team', () => {
    expect(() => parseSuiteRef('onboarding-pack', undefined)).toThrow(/team/i);
  });
  it('rejects non-numeric teamId', () => {
    expect(() => parseSuiteRef('abc/onboarding-pack', undefined)).toThrow(/team/i);
  });
  it('rejects empty slug', () => {
    expect(() => parseSuiteRef('1/', undefined)).toThrow(/slug/i);
  });
  it('rejects too many segments', () => {
    expect(() => parseSuiteRef('1/2/3', undefined)).toThrow(/format/i);
  });
});
