import fs from 'node:fs';
import path from 'node:path';
import { smskillHome } from './config';
import { fsError } from './errors';
import type { Agent, Scope } from './target';

export interface LockEntry {
  slug: string;
  name: string;
  version: string;
  agent: Agent;
  scope: Scope;
  /** agent 可见路径：软链模式下是软链路径，直装模式下是真实目录。 */
  path: string;
  /** 软链模式下真实内容所在目录（多 agent 共享）；直装/旧记录为空。 */
  store?: string;
  source: 'skillstack' | 'skillstack-prompt';
  apiBaseUrl: string;
  downloadPath?: string;
  installedAt: string;
  via?: { suite: string; suiteId: number };
}

interface LockFile {
  version: 1;
  entries: LockEntry[];
}

export function lockfilePath(): string {
  return path.join(smskillHome(), 'installed.json');
}

function ensureHome(): void {
  const dir = smskillHome();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
}

export function readLockfile(): LockFile {
  const p = lockfilePath();
  if (!fs.existsSync(p)) return { version: 1, entries: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (raw && raw.version === 1 && Array.isArray(raw.entries)) return raw;
    throw fsError('schema mismatch');
  } catch (e) {
    throw fsError(`lockfile at ${p} is invalid: ${(e as Error).message}`);
  }
}

function writeLockfile(lock: LockFile): void {
  ensureHome();
  const p = lockfilePath();
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(lock, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, p);
  fs.chmodSync(p, 0o600);
}

function sameKey(a: LockEntry, b: { slug: string; agent: Agent; scope: Scope; path: string }): boolean {
  return a.slug === b.slug && a.agent === b.agent && a.scope === b.scope && a.path === b.path;
}

export function upsertEntry(entry: LockEntry): void {
  const lock = readLockfile();
  const idx = lock.entries.findIndex(e => sameKey(e, entry));
  if (idx >= 0) lock.entries[idx] = entry;
  else lock.entries.push(entry);
  writeLockfile(lock);
}

export function removeEntry(key: { slug: string; agent: Agent; scope: Scope; path: string }): boolean {
  const lock = readLockfile();
  const before = lock.entries.length;
  lock.entries = lock.entries.filter(e => !sameKey(e, key));
  if (lock.entries.length === before) return false;
  writeLockfile(lock);
  return true;
}

export interface FindFilter {
  slug?: string;
  agent?: Agent;
  scope?: Scope;
  suite?: string;
}

export function findEntries(filter: FindFilter): LockEntry[] {
  const lock = readLockfile();
  return lock.entries.filter(e => {
    if (filter.slug && e.slug !== filter.slug) return false;
    if (filter.agent && e.agent !== filter.agent) return false;
    if (filter.scope && e.scope !== filter.scope) return false;
    if (filter.suite && e.via?.suite !== filter.suite) return false;
    return true;
  });
}
