import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLockfile, upsertEntry, removeEntry, findEntries, lockfilePath, type LockEntry } from '../../src/core/lockfile';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-lock-'));
  process.env.SMSKILL_HOME = tmpHome;
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  delete process.env.SMSKILL_HOME;
});

function makeEntry(over: Partial<LockEntry> = {}): LockEntry {
  return {
    slug: 'weather-helper',
    name: 'Weather Helper',
    version: '1.0.0',
    agent: 'claude',
    scope: 'user',
    path: '/Users/x/.claude/skills/weather-helper',
    source: 'skillstack',
    apiBaseUrl: 'http://localhost:8080',
    installedAt: '2026-05-22T00:00:00Z',
    ...over,
  };
}

describe('lockfile', () => {
  it('returns empty list when file missing', () => {
    expect(readLockfile().entries).toEqual([]);
  });

  it('upsert appends new entries', () => {
    upsertEntry(makeEntry({ slug: 'a' }));
    upsertEntry(makeEntry({ slug: 'b' }));
    expect(readLockfile().entries.map(e => e.slug)).toEqual(['a', 'b']);
  });

  it('upsert overwrites by (slug,agent,scope,path)', () => {
    upsertEntry(makeEntry({ version: '1.0.0' }));
    upsertEntry(makeEntry({ version: '2.0.0' }));
    const lock = readLockfile();
    expect(lock.entries).toHaveLength(1);
    expect(lock.entries[0].version).toBe('2.0.0');
  });

  it('upsert keeps separate rows when only agent differs', () => {
    upsertEntry(makeEntry({ agent: 'claude' }));
    upsertEntry(makeEntry({ agent: 'codex', path: '/Users/x/.codex/skills/weather-helper' }));
    expect(readLockfile().entries).toHaveLength(2);
  });

  it('removeEntry deletes by composite key', () => {
    upsertEntry(makeEntry({ slug: 'a' }));
    upsertEntry(makeEntry({ slug: 'b' }));
    const removed = removeEntry({ slug: 'a', agent: 'claude', scope: 'user', path: makeEntry({ slug: 'a' }).path });
    expect(removed).toBe(true);
    expect(readLockfile().entries.map(e => e.slug)).toEqual(['b']);
  });

  it('removeEntry returns false on miss', () => {
    expect(removeEntry({ slug: 'nope', agent: 'claude', scope: 'user', path: '/x' })).toBe(false);
  });

  it('findEntries filters by slug', () => {
    upsertEntry(makeEntry({ slug: 'a' }));
    upsertEntry(makeEntry({ slug: 'b' }));
    expect(findEntries({ slug: 'a' }).map(e => e.slug)).toEqual(['a']);
  });

  it('findEntries filters by agent and scope', () => {
    upsertEntry(makeEntry({ slug: 'a', agent: 'claude', scope: 'user' }));
    upsertEntry(makeEntry({ slug: 'a', agent: 'codex', scope: 'user', path: '/p2' }));
    upsertEntry(makeEntry({ slug: 'a', agent: 'claude', scope: 'project', path: '/p3' }));
    expect(findEntries({ slug: 'a', agent: 'claude' })).toHaveLength(2);
    expect(findEntries({ slug: 'a', agent: 'claude', scope: 'user' })).toHaveLength(1);
  });

  it('findEntries filters by suite ref via.suite', () => {
    upsertEntry(makeEntry({ slug: 'a', via: { suite: '1/pack', suiteId: 9 } }));
    upsertEntry(makeEntry({ slug: 'b' }));
    expect(findEntries({ suite: '1/pack' }).map(e => e.slug)).toEqual(['a']);
  });

  it('writes lockfile with 0600 perms', () => {
    upsertEntry(makeEntry());
    const mode = fs.statSync(lockfilePath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
