import { describe, it, expect } from 'vitest';
import { resolveTarget } from '../../src/core/target';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();

describe('resolveTarget', () => {
  it('claude user', () => {
    expect(resolveTarget({ agent: 'claude', scope: 'user', cwd: '/anything' }))
      .toBe(path.join(home, '.claude', 'skills'));
  });
  it('claude project', () => {
    expect(resolveTarget({ agent: 'claude', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', '.claude', 'skills'));
  });
  it('codex user', () => {
    expect(resolveTarget({ agent: 'codex', scope: 'user', cwd: '/x' }))
      .toBe(path.join(home, '.codex', 'skills'));
  });
  it('codex project', () => {
    expect(resolveTarget({ agent: 'codex', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', '.codex', 'skills'));
  });
  it('openclaw user', () => {
    expect(resolveTarget({ agent: 'openclaw', scope: 'user', cwd: '/x' }))
      .toBe(path.join(home, '.openclaw', 'skills'));
  });
  it('openclaw project uses workspace skills/', () => {
    expect(resolveTarget({ agent: 'openclaw', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', 'skills'));
  });
  it('generic user', () => {
    expect(resolveTarget({ agent: 'generic', scope: 'user', cwd: '/x' }))
      .toBe(path.join(home, '.smskill', 'skills'));
  });
  it('generic project', () => {
    expect(resolveTarget({ agent: 'generic', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', 'skills'));
  });
  it('--dir override wins', () => {
    expect(resolveTarget({ agent: 'claude', scope: 'user', cwd: '/proj', dir: '/custom/path' }))
      .toBe('/custom/path');
  });
  it('rejects unknown agent', () => {
    // @ts-expect-error testing invalid input
    expect(() => resolveTarget({ agent: 'bogus', scope: 'user', cwd: '/x' })).toThrow(/agent/);
  });
  it('rejects unknown scope', () => {
    // @ts-expect-error testing invalid input
    expect(() => resolveTarget({ agent: 'claude', scope: 'bogus', cwd: '/x' })).toThrow(/scope/);
  });
});
