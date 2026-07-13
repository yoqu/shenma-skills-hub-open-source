import type { LocalInstallEntry } from './types';

const KEY = 'skillstack.desktop.installs.v1';

export function readLocalInstalls(): LocalInstallEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalInstalls(entries: LocalInstallEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries, null, 2));
}

export function upsertLocalInstall(entry: LocalInstallEntry) {
  const entries = readLocalInstalls();
  const next = entries.filter((item) => {
    if (entry.userSkillId > 0 && item.userSkillId > 0) {
      return item.userSkillId !== entry.userSkillId;
    }
    return item.slug !== entry.slug;
  });
  next.push(entry);
  writeLocalInstalls(next);
}

export function setFallbackLocalEnabled(userSkillId: number | undefined, slug: string, enabled: boolean) {
  writeLocalInstalls(readLocalInstalls().map((item) => {
    const matches = Boolean(userSkillId && item.userSkillId === userSkillId) || item.slug === slug;
    if (!matches) return item;
    return {
      ...item,
      enabledClaude: enabled,
      enabledCodex: false,
      updatedAt: new Date().toISOString(),
    };
  }));
}

export function removeLocalInstall(userSkillId: number | undefined, slug?: string) {
  writeLocalInstalls(readLocalInstalls().filter((item) => {
    if (userSkillId && item.userSkillId === userSkillId) {
      return false;
    }
    if (slug && item.slug === slug) {
      return false;
    }
    return true;
  }));
}
