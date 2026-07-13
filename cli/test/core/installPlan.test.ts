import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { buildInstallPlan, agentsStoreRoot, INSTALL_AGENTS } from '../../src/core/target';

describe('buildInstallPlan', () => {
  it('direct mode (--dir): real extract, no symlinks', () => {
    const plan = buildInstallPlan({ slug: 'foo', agents: ['claude'], scope: 'user', cwd: '/work', dir: '/tmp/out' });
    expect(plan.direct).toBe(true);
    expect(plan.contentPath).toBe(path.resolve('/tmp/out', 'foo'));
    expect(plan.targets).toEqual([]);
  });

  it('project scope: content lives in <cwd>/.agents/skills, agents symlink in', () => {
    const plan = buildInstallPlan({ slug: 'foo', agents: ['claude', 'codex'], scope: 'project', cwd: '/work' });
    expect(plan.direct).toBe(false);
    expect(plan.contentPath).toBe(path.join('/work', '.agents', 'skills', 'foo'));
    expect(plan.targets).toEqual([
      { agent: 'claude', linkPath: path.join('/work', '.claude', 'skills', 'foo') },
      { agent: 'codex', linkPath: path.join('/work', '.codex', 'skills', 'foo') },
    ]);
  });

  it('user scope: content lives under ~/.agents/skills', () => {
    const plan = buildInstallPlan({ slug: 'foo', agents: INSTALL_AGENTS, scope: 'user', cwd: '/work' });
    expect(plan.contentPath).toBe(path.join(os.homedir(), '.agents', 'skills', 'foo'));
    expect(plan.targets.map(t => t.agent)).toEqual(['claude', 'codex']);
    expect(plan.targets[0].linkPath).toBe(path.join(os.homedir(), '.claude', 'skills', 'foo'));
  });

  it('agentsStoreRoot differs by scope', () => {
    expect(agentsStoreRoot('user', '/work')).toBe(path.join(os.homedir(), '.agents', 'skills'));
    expect(agentsStoreRoot('project', '/work')).toBe(path.join('/work', '.agents', 'skills'));
  });
});
