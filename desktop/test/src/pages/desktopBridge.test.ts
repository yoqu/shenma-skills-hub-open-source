import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSkillItemRes } from '@/api/endpoints';
import { http } from '@/api/client';
import {
  exportDesktopLogs,
  installDesktopSkill,
  readDesktopSettings,
  saveDesktopSettings,
  scanLocalSkills,
  setDesktopSkillEnabled,
} from '../../../src/pages/desktopBridge';
import type { LocalInstallEntry } from '../../../src/pages/types';

function cloud(overrides: Partial<UserSkillItemRes> = {}): UserSkillItemRes {
  return {
    id: 10,
    source: 'PERSONAL',
    skillId: 0,
    reviewId: 0,
    slug: 'cloud-skill',
    name: 'Cloud Skill',
    shortDesc: '',
    catCode: '',
    icon: '',
    version: '1.0.0',
    zipUrl: 'skill-versions/10/cloud-skill.zip',
    filesCount: 1,
    safety: 'pass',
    evalScore: 0,
    langs: '[]',
    ...overrides,
  };
}

function local(overrides: Partial<LocalInstallEntry> = {}): LocalInstallEntry {
  return {
    userSkillId: 10,
    source: 'PERSONAL',
    skillId: 0,
    slug: 'cloud-skill',
    name: 'Cloud Skill',
    version: '1.0.0',
    installPath: '/tmp/cloud-skill',
    updatedAt: '2026-05-29T00:00:00.000Z',
    enabledClaude: true,
    enabledCodex: false,
    installSource: 'electron',
    ...overrides,
  };
}

function mockDesktopApi(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal('window', {
    skillstackDesktop: {
      scanSkills: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      getConfig: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          agent: 'CLAUDE',
          agents: ['CLAUDE'],
          skillStorageLocation: 'skillstack',
          skillSyncMethod: 'symlink',
          apiBaseUrl: 'http://localhost:8080',
          skillHomeDir: '~/.skillstack/skills',
          claudeSkillsDir: '~/.claude/skills',
          codexSkillsDir: '~/.codex/skills',
        },
      }),
      saveConfig: vi.fn().mockImplementation((config) => ({
        ok: true,
        data: {
          agent: 'CLAUDE',
          agents: ['CLAUDE'],
          skillStorageLocation: 'skillstack',
          skillSyncMethod: 'symlink',
          apiBaseUrl: 'http://localhost:8080',
          skillHomeDir: '~/.skillstack/skills',
          claudeSkillsDir: '~/.claude/skills',
          codexSkillsDir: '~/.codex/skills',
          ...config,
        },
      })),
      listLocalInstalls: vi.fn().mockResolvedValue({ ok: true, data: [local()] }),
      upsertLocalInstall: vi.fn().mockResolvedValue({ ok: true, data: local() }),
      removeLocalInstall: vi.fn().mockResolvedValue({ ok: true, data: { removed: true } }),
      setLocalSkillEnabled: vi.fn().mockResolvedValue({ ok: true, data: local() }),
      installSkill: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          slug: 'cloud-skill',
          name: 'Cloud Skill',
          version: '1.0.0',
          installPath: '/tmp/cloud-skill',
          updatedAt: '2026-05-29T00:00:00.000Z',
        },
      }),
      uninstallSkill: vi.fn().mockResolvedValue({ ok: true, data: { slug: 'cloud-skill' } }),
      exportLogs: vi.fn().mockResolvedValue({ ok: true, data: { filePath: '/tmp/logs.zip', files: ['skillstack-desktop.log'] } }),
      ...overrides,
    },
  });
}

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  });
});

afterEach(() => {
  http.defaults.baseURL = 'http://localhost:8080/api';
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('desktop local install source', () => {
  it('applies backend address from desktop settings to the API client', async () => {
    mockDesktopApi({
      getConfig: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          agent: 'CLAUDE',
          agents: ['CLAUDE'],
          skillStorageLocation: 'skillstack',
          skillSyncMethod: 'symlink',
          apiBaseUrl: 'http://localhost:18080',
          skillHomeDir: '~/.skillstack/skills',
          claudeSkillsDir: '~/.claude/skills',
          codexSkillsDir: '~/.codex/skills',
        },
      }),
    });

    await readDesktopSettings();

    expect(http.defaults.baseURL).toBe('http://localhost:18080/api');
  });

  it('applies saved backend address to the API client', async () => {
    mockDesktopApi();

    await saveDesktopSettings({
      agent: 'CLAUDE',
      agents: ['CLAUDE'],
      skillStorageLocation: 'skillstack',
      skillSyncMethod: 'symlink',
      apiBaseUrl: 'http://localhost:18081',
      skillHomeDir: '~/.skillstack/skills',
      claudeSkillsDir: '~/.claude/skills',
      codexSkillsDir: '~/.codex/skills',
    });

    expect(http.defaults.baseURL).toBe('http://localhost:18081/api');
  });

  it('reads local installs from local metadata, not directory scan results', async () => {
    const scanSkills = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          slug: 'unrelated-disk-skill',
          name: 'Unrelated Disk Skill',
          version: '1.0.0',
          installPath: '/tmp/unrelated-disk-skill',
          updatedAt: '2026-05-29T00:00:00.000Z',
        },
      ],
    });
    const listLocalInstalls = vi.fn().mockResolvedValue({ ok: true, data: [local()] });
    mockDesktopApi({ scanSkills, listLocalInstalls });

    const entries = await scanLocalSkills([cloud()]);

    expect(scanSkills).not.toHaveBeenCalled();
    expect(listLocalInstalls).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('cloud-skill');
  });

  it('exports desktop logs through the desktop bridge', async () => {
    const exportLogs = vi.fn().mockResolvedValue({
      ok: true,
      data: { filePath: '/tmp/skillstack-desktop-logs.zip', files: ['skillstack-desktop.log'] },
    });
    mockDesktopApi({ exportLogs });

    await expect(exportDesktopLogs()).resolves.toEqual({
      filePath: '/tmp/skillstack-desktop-logs.zip',
      files: ['skillstack-desktop.log'],
    });
    expect(exportLogs).toHaveBeenCalledTimes(1);
  });

  it('records electron install result into local metadata for later cloud/local merging', async () => {
    const installSkill = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        slug: 'cloud-skill',
        name: 'Cloud Skill',
        version: '1.0.0',
        installPath: '/tmp/cloud-skill',
        updatedAt: '2026-05-29T00:00:00.000Z',
      },
    });
    mockDesktopApi({ installSkill });

    await installDesktopSkill(cloud());

    expect(installSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        userSkillId: 10,
        source: 'PERSONAL',
        skillId: 0,
        slug: 'cloud-skill',
        version: '1.0.0',
        zipUrl: 'http://localhost:8080/uploads/skill-versions/10/cloud-skill.zip',
      }),
    );
  });

  it('installs subscribed skills through the default package download endpoint used by smskill', async () => {
    const installSkill = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        slug: 'cloud-skill',
        name: 'Cloud Skill',
        version: '1.0.0',
        installPath: '/tmp/cloud-skill',
        updatedAt: '2026-05-29T00:00:00.000Z',
      },
    });
    mockDesktopApi({ installSkill });

    await installDesktopSkill(cloud({ source: 'PUBLIC', publicVersion: '1.0.0' }));

    expect(installSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'PUBLIC',
        zipUrl: 'http://localhost:8080/api/skills/cloud-skill/download',
      }),
    );
  });

  it('disables local skills through setLocalSkillEnabled instead of uninstalling', async () => {
    const setLocalSkillEnabled = vi.fn().mockResolvedValue({
      ok: true,
      data: local({ enabledClaude: false, enabledCodex: false }),
    });
    const uninstallSkill = vi.fn();
    mockDesktopApi({ setLocalSkillEnabled, uninstallSkill });

    await setDesktopSkillEnabled('cloud-skill', 10, false);

    expect(setLocalSkillEnabled).toHaveBeenCalledWith({ userSkillId: 10, slug: 'cloud-skill', enabled: false });
    expect(uninstallSkill).not.toHaveBeenCalled();
  });

  it('enables local skills through setLocalSkillEnabled when cache exists', async () => {
    const setLocalSkillEnabled = vi.fn().mockResolvedValue({
      ok: true,
      data: local({ enabledClaude: true, enabledCodex: false }),
    });
    mockDesktopApi({ setLocalSkillEnabled });

    await setDesktopSkillEnabled('cloud-skill', 10, true);

    expect(setLocalSkillEnabled).toHaveBeenCalledWith({ userSkillId: 10, slug: 'cloud-skill', enabled: true });
  });

  it('does not silently fall back when the desktop API lacks setLocalSkillEnabled', async () => {
    mockDesktopApi({ setLocalSkillEnabled: undefined });

    await expect(setDesktopSkillEnabled('cloud-skill', 10, true)).rejects.toThrow('Desktop set-enabled API is unavailable.');
  });
});
