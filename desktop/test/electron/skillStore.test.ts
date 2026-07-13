import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDesktopLogger, createMemoryLogWriter } from '../../electron/logger';

let tmpHome: string;

describe('skillStore', () => {
  beforeEach(async () => {
    tmpHome = await fs.mkdtemp('/tmp/skillstack-store-');
    process.env.SKILLSTACK_HOME = path.join(tmpHome, '.skillstack');
    process.env.SKILLSTACK_USER_HOME = tmpHome;
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
    delete process.env.SKILLSTACK_HOME;
    delete process.env.SKILLSTACK_USER_HOME;
  });

  it('stores settings like cc-switch under ~/.skillstack with symlink sync as default', async () => {
    const store = await import('../../electron/skillStore');

    const settings = await store.readSkillStoreSettings();

    expect(settings).toMatchObject({
      agent: 'CLAUDE',
      agents: ['CLAUDE'],
      skillStorageLocation: 'skillstack',
      skillSyncMethod: 'symlink',
      apiBaseUrl: 'http://localhost:8080',
      skillHomeDir: path.join(tmpHome, '.skillstack', 'skills'),
      claudeSkillsDir: path.join(tmpHome, '.claude', 'skills'),
      codexSkillsDir: path.join(tmpHome, '.codex', 'skills'),
    });
  });

  it('normalizes backend address settings when saving', async () => {
    const store = await import('../../electron/skillStore');

    const settings = await store.saveSkillStoreSettings({ apiBaseUrl: ' http://localhost:18080/api/ ' });

    expect(settings.apiBaseUrl).toBe('http://localhost:18080');
    await expect(store.readSkillStoreSettings()).resolves.toMatchObject({
      apiBaseUrl: 'http://localhost:18080',
    });
  });

  it('logs settings saves with safe summaries', async () => {
    const store = await import('../../electron/skillStore');
    const writer = createMemoryLogWriter();
    store.setSkillStoreLogger(createDesktopLogger({ writer, now: () => new Date(2026, 5, 4, 2, 12, 33) }));

    await store.saveSkillStoreSettings({ agents: ['CLAUDE', 'CODEX'], apiBaseUrl: 'http://localhost:18080/api/' });

    const output = writer.lines.join('\n');
    expect(output).toContain('[INFO][skillstack_desktop::store] skill store settings saved');
    expect(output).toContain('agents=["CLAUDE","CODEX"]');
    expect(output).toContain('apiBaseUrl=http://localhost:18080');
  });

  it('records installed skills in sqlite and symlinks them to the enabled app skills dir', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agent: 'CODEX' });
    const installPath = await store.getSkillInstallPath('demo-skill');
    await fs.mkdir(installPath, { recursive: true });
    await fs.writeFile(path.join(installPath, 'SKILL.md'), '# Demo\n', 'utf8');

    await store.upsertLocalSkillRecord({
      userSkillId: 10,
      source: 'PERSONAL',
      skillId: 0,
      slug: 'demo-skill',
      name: 'Demo Skill',
      version: '1.0.0',
      installedAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z',
    });

    const rows = await store.listLocalInstalls();
    const codexLink = path.join(tmpHome, '.codex', 'skills', 'demo-skill');
    const stat = await fs.lstat(codexLink);

    expect(rows).toEqual([
      expect.objectContaining({
        userSkillId: 10,
        source: 'PERSONAL',
        slug: 'demo-skill',
        name: 'Demo Skill',
        version: '1.0.0',
        installPath,
      }),
    ]);
    expect(stat.isSymbolicLink()).toBe(true);
    await expect(fs.realpath(codexLink)).resolves.toBe(await fs.realpath(installPath));
  });

  it('syncs installed skills to every selected default target', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE', 'CODEX'] });
    const installPath = await store.getSkillInstallPath('multi-target-skill');
    await fs.mkdir(installPath, { recursive: true });
    await fs.writeFile(path.join(installPath, 'SKILL.md'), '# Demo\n', 'utf8');

    await store.upsertLocalSkillRecord({
      userSkillId: 11,
      source: 'PUBLIC',
      skillId: 99,
      slug: 'multi-target-skill',
      name: 'Multi Target Skill',
      version: '1.0.0',
      installedAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z',
    });

    const claudeLink = path.join(tmpHome, '.claude', 'skills', 'multi-target-skill');
    const codexLink = path.join(tmpHome, '.codex', 'skills', 'multi-target-skill');
    await expect(fs.realpath(claudeLink)).resolves.toBe(await fs.realpath(installPath));
    await expect(fs.realpath(codexLink)).resolves.toBe(await fs.realpath(installPath));
  });

  it('returns enabled fields in local install entries', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE', 'CODEX'] });
    const installPath = await store.getSkillInstallPath('enabled-state-skill');
    await fs.mkdir(installPath, { recursive: true });
    await fs.writeFile(path.join(installPath, 'SKILL.md'), '# Enabled State\n', 'utf8');

    await store.upsertLocalSkillRecord({
      userSkillId: 12,
      source: 'PUBLIC',
      skillId: 100,
      slug: 'enabled-state-skill',
      name: 'Enabled State Skill',
      version: '1.0.0',
      installedAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
    });

    const [entry] = await store.listLocalInstalls();

    expect(entry).toMatchObject({
      slug: 'enabled-state-skill',
      enabledClaude: true,
      enabledCodex: true,
    });
  });

  it('disables a local skill by removing agent sync paths while keeping sqlite and cache', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE', 'CODEX'], skillSyncMethod: 'symlink' });
    const installPath = await installCachedSkill(store, 'disable-keeps-cache', {
      userSkillId: 13,
      source: 'PUBLIC',
      skillId: 101,
      name: 'Disable Keeps Cache',
    });

    await store.setLocalSkillEnabled({ slug: 'disable-keeps-cache', enabled: false });

    const [entry] = await store.listLocalInstalls();
    expect(entry).toMatchObject({
      slug: 'disable-keeps-cache',
      enabledClaude: false,
      enabledCodex: false,
    });
    await expect(fs.stat(installPath)).resolves.toBeTruthy();
    await expect(fs.lstat(path.join(tmpHome, '.claude', 'skills', 'disable-keeps-cache'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.lstat(path.join(tmpHome, '.codex', 'skills', 'disable-keeps-cache'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('logs enable and disable operations with target agents', async () => {
    const store = await import('../../electron/skillStore');
    const writer = createMemoryLogWriter();
    store.setSkillStoreLogger(createDesktopLogger({ writer, now: () => new Date(2026, 5, 4, 2, 12, 33) }));
    await store.saveSkillStoreSettings({ agents: ['CLAUDE', 'CODEX'], skillSyncMethod: 'symlink' });
    await installCachedSkill(store, 'logged-enable-disable', {
      userSkillId: 18,
      source: 'PUBLIC',
      skillId: 106,
      name: 'Logged Enable Disable',
    });
    writer.lines.length = 0;

    await store.setLocalSkillEnabled({ slug: 'logged-enable-disable', enabled: false });
    await store.setLocalSkillEnabled({ slug: 'logged-enable-disable', enabled: true });

    const output = writer.lines.join('\n');
    expect(output).toContain('local skill disabled');
    expect(output).toContain('local skill enabled');
    expect(output).toContain('slug=logged-enable-disable');
    expect(output).toContain('agents=["CLAUDE","CODEX"]');
  });

  it('enables a disabled local skill by syncing from the cache directory', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE', 'CODEX'], skillSyncMethod: 'symlink' });
    const installPath = await installCachedSkill(store, 'enable-from-cache', {
      userSkillId: 14,
      source: 'PUBLIC',
      skillId: 102,
      name: 'Enable From Cache',
    });

    await store.setLocalSkillEnabled({ slug: 'enable-from-cache', enabled: false });
    await store.setLocalSkillEnabled({ slug: 'enable-from-cache', enabled: true });

    const [entry] = await store.listLocalInstalls();
    expect(entry.enabledClaude).toBe(true);
    expect(entry.enabledCodex).toBe(true);
    await expect(fs.realpath(path.join(tmpHome, '.claude', 'skills', 'enable-from-cache'))).resolves.toBe(await fs.realpath(installPath));
    await expect(fs.realpath(path.join(tmpHome, '.codex', 'skills', 'enable-from-cache'))).resolves.toBe(await fs.realpath(installPath));
  });

  it('removes copied agent directories when disabling copy synced skills', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE'], skillSyncMethod: 'copy' });
    const installPath = await installCachedSkill(store, 'copy-disable', {
      userSkillId: 15,
      source: 'PUBLIC',
      skillId: 103,
      name: 'Copy Disable',
    });
    const copyPath = path.join(tmpHome, '.claude', 'skills', 'copy-disable');
    expect((await fs.lstat(copyPath)).isSymbolicLink()).toBe(false);

    await store.setLocalSkillEnabled({ slug: 'copy-disable', enabled: false });

    await expect(fs.stat(installPath)).resolves.toBeTruthy();
    await expect(fs.lstat(copyPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('resyncs enabled skills when switching from symlink to copy without changing cache', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE'], skillSyncMethod: 'symlink' });
    const installPath = await installCachedSkill(store, 'switch-sync-method', {
      userSkillId: 16,
      source: 'PUBLIC',
      skillId: 104,
      name: 'Switch Sync Method',
    });

    const agentPath = path.join(tmpHome, '.claude', 'skills', 'switch-sync-method');
    expect((await fs.lstat(agentPath)).isSymbolicLink()).toBe(true);
    const beforeCacheMtime = (await fs.stat(installPath)).mtimeMs;

    await store.saveSkillStoreSettings({ agents: ['CLAUDE'], skillSyncMethod: 'copy' });
    await store.resyncEnabledSkillRecords();

    expect((await fs.lstat(agentPath)).isSymbolicLink()).toBe(false);
    await expect(fs.readFile(path.join(agentPath, 'SKILL.md'), 'utf8')).resolves.toContain('Switch Sync Method');
    expect((await fs.stat(installPath)).mtimeMs).toBe(beforeCacheMtime);
  });

  it('does not recreate agent directories for disabled skills when settings are resynced', async () => {
    const store = await import('../../electron/skillStore');
    await store.saveSkillStoreSettings({ agents: ['CLAUDE'], skillSyncMethod: 'symlink' });
    const installPath = await installCachedSkill(store, 'disabled-resync', {
      userSkillId: 17,
      source: 'PUBLIC',
      skillId: 105,
      name: 'Disabled Resync',
    });

    await store.setLocalSkillEnabled({ slug: 'disabled-resync', enabled: false });
    await store.saveSkillStoreSettings({ agents: ['CLAUDE'], skillSyncMethod: 'copy' });
    await store.resyncEnabledSkillRecords();

    await expect(fs.stat(installPath)).resolves.toBeTruthy();
    await expect(fs.lstat(path.join(tmpHome, '.claude', 'skills', 'disabled-resync'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('logs resync summaries and sync failures', async () => {
    const store = await import('../../electron/skillStore');
    const writer = createMemoryLogWriter();
    store.setSkillStoreLogger(createDesktopLogger({ writer, now: () => new Date(2026, 5, 4, 2, 12, 33) }));
    await store.saveSkillStoreSettings({ agents: ['CLAUDE'], skillSyncMethod: 'symlink' });
    const installPath = await installCachedSkill(store, 'logged-resync', {
      userSkillId: 19,
      source: 'PUBLIC',
      skillId: 107,
      name: 'Logged Resync',
    });
    writer.lines.length = 0;

    await store.resyncEnabledSkillRecords();
    await fs.rm(installPath, { recursive: true, force: true });
    await expect(store.resyncEnabledSkillRecords()).rejects.toThrow('LOCAL_SKILL_CACHE_MISSING');

    const output = writer.lines.join('\n');
    expect(output).toContain('enabled local skills resynced synced=1');
    expect(output).toContain('local skill sync failed');
    expect(output).toContain('slug=logged-resync');
  });
});

async function installCachedSkill(
  store: typeof import('../../electron/skillStore'),
  slug: string,
  input: {
    userSkillId: number;
    source: 'PERSONAL' | 'TEAM' | 'PUBLIC';
    skillId: number;
    name: string;
  },
): Promise<string> {
  const installPath = await store.getSkillInstallPath(slug);
  await fs.mkdir(installPath, { recursive: true });
  await fs.writeFile(path.join(installPath, 'SKILL.md'), `# ${input.name}\n`, 'utf8');

  await store.upsertLocalSkillRecord({
    userSkillId: input.userSkillId,
    source: input.source,
    skillId: input.skillId,
    slug,
    name: input.name,
    version: '1.0.0',
    installedAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
  });

  return installPath;
}
