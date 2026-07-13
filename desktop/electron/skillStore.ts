import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createInstallLogContext, logInstallStep, type InstallLogContext } from './installLogging';
import type { DesktopLogger } from './logger';

const execFileAsync = promisify(execFile);

export type SkillStoreAgent = 'CLAUDE' | 'CODEX';
export type SkillStoreUserSkillSource = 'PERSONAL' | 'TEAM' | 'PUBLIC';
export type SkillStoreSyncMethod = 'symlink' | 'copy';
export type SkillStoreStorageLocation = 'skillstack';

export type SkillStoreSettings = {
  agent: SkillStoreAgent;
  agents: SkillStoreAgent[];
  skillStorageLocation: SkillStoreStorageLocation;
  skillSyncMethod: SkillStoreSyncMethod;
  apiBaseUrl: string;
  skillHomeDir: string;
  claudeSkillsDir: string;
  codexSkillsDir: string;
};

export type LocalSkillRecord = {
  userSkillId: number;
  source: SkillStoreUserSkillSource;
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  directory: string;
  installPath: string;
  installedAt: string;
  updatedAt: string;
  enabledClaude: boolean;
  enabledCodex: boolean;
};

export type LocalInstallEntry = {
  userSkillId: number;
  source: SkillStoreUserSkillSource;
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  agent?: SkillStoreAgent;
  installPath: string;
  installedAt?: string;
  updatedAt: string;
  enabledClaude: boolean;
  enabledCodex: boolean;
  installSource?: 'electron' | 'fallback';
};

export type SkillInstallMetadata = {
  installId?: string;
  userSkillId: number;
  source: SkillStoreUserSkillSource;
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  installedAt: string;
  updatedAt: string;
};

const settingsFileName = 'settings.json';
const databaseFileName = 'skillstack.db';
const skillsDirName = 'skills';
const supportedAgents: SkillStoreAgent[] = ['CLAUDE', 'CODEX'];
const supportedSkillSources: SkillStoreUserSkillSource[] = ['PERSONAL', 'TEAM', 'PUBLIC'];
const slowSyncThresholdMs = 5000;
const slowSqliteThresholdMs = 1000;
const noopLogger: DesktopLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
let skillStoreLogger: DesktopLogger = noopLogger;

export function setSkillStoreLogger(logger: DesktopLogger): void {
  skillStoreLogger = logger;
}

export function getSkillStackHomeDir(): string {
  if (process.env.SKILLSTACK_HOME) {
    return path.resolve(process.env.SKILLSTACK_HOME);
  }
  return path.join(getUserHomeDir(), '.skillstack');
}

export function getSkillStoreSettingsPath(): string {
  return path.join(getSkillStackHomeDir(), settingsFileName);
}

export function getSkillStoreDatabasePath(): string {
  return path.join(getSkillStackHomeDir(), databaseFileName);
}

export function getDefaultSkillStoreSettings(): SkillStoreSettings {
  return {
    agent: 'CLAUDE',
    agents: ['CLAUDE'],
    skillStorageLocation: 'skillstack',
    skillSyncMethod: 'symlink',
    apiBaseUrl: 'http://localhost:8080',
    skillHomeDir: path.join(getSkillStackHomeDir(), skillsDirName),
    claudeSkillsDir: path.join(getUserHomeDir(), '.claude', 'skills'),
    codexSkillsDir: path.join(getUserHomeDir(), '.codex', 'skills'),
  };
}

export async function readSkillStoreSettings(): Promise<SkillStoreSettings> {
  try {
    const content = await fs.readFile(getSkillStoreSettingsPath(), 'utf8');
    return normalizeSettings(JSON.parse(content));
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return getDefaultSkillStoreSettings();
    }
    throw error;
  }
}

export async function saveSkillStoreSettings(input: unknown): Promise<SkillStoreSettings> {
  const current = await readSkillStoreSettings();
  const value = input && typeof input === 'object' ? input as Partial<SkillStoreSettings> : {};
  const merged = { ...current, ...value };
  if (!Array.isArray(value.agents) && isAgent(value.agent)) {
    merged.agents = [value.agent];
  }
  const next = normalizeSettings(merged);

  await fs.mkdir(path.dirname(getSkillStoreSettingsPath()), { recursive: true });
  await fs.writeFile(getSkillStoreSettingsPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  skillStoreLogger.info('skillstack_desktop::store', 'skill store settings saved', {
    agents: next.agents,
    skillSyncMethod: next.skillSyncMethod,
    apiBaseUrl: next.apiBaseUrl,
    skillHomeDir: next.skillHomeDir,
  });

  return next;
}

export async function listLocalSkillRecords(): Promise<LocalSkillRecord[]> {
  await ensureSkillStoreDatabase();
  const sql = `SELECT user_skill_id AS userSkillId,
            source,
            skill_id AS skillId,
            slug,
            name,
            version,
            directory,
            install_path AS installPath,
            installed_at AS installedAt,
            updated_at AS updatedAt,
            enabled_claude AS enabledClaude,
            enabled_codex AS enabledCodex
       FROM skills
      ORDER BY updated_at DESC, slug ASC;`;
  const stdout = await runSqlite(sql);
  const rows = stdout.trim() ? JSON.parse(stdout) as Array<Record<string, unknown>> : [];

  return rows.map(rowToLocalSkillRecord).filter((item): item is LocalSkillRecord => Boolean(item));
}

export async function listLocalInstalls(): Promise<LocalInstallEntry[]> {
  const records = await listLocalSkillRecords();
  return records.map(recordToInstallEntry);
}

export async function upsertLocalSkillRecord(input: unknown): Promise<LocalInstallEntry> {
  const metadata = normalizeInstallMetadata(input);
  if (!metadata) {
    throw new Error('INVALID_LOCAL_INSTALL');
  }

  const settings = await readSkillStoreSettings();
  const installPath = path.join(settings.skillHomeDir, metadata.slug);
  const existing = await findLocalSkillRecord(metadata.userSkillId, metadata.slug);
  const record: LocalSkillRecord = {
    userSkillId: metadata.userSkillId,
    source: metadata.source,
    skillId: metadata.skillId,
    slug: metadata.slug,
    name: metadata.name,
    version: metadata.version,
    directory: metadata.slug,
    installPath,
    installedAt: existing?.installedAt || metadata.installedAt,
    updatedAt: metadata.updatedAt,
    enabledClaude: existing?.enabledClaude ?? settings.agents.includes('CLAUDE'),
    enabledCodex: existing?.enabledCodex ?? settings.agents.includes('CODEX'),
  };

  await ensureSkillStoreDatabase();
  await runSqlite(buildUpsertSkillSql(record));
  const installLogContext = metadata.installId ? createInstallLogContext({
    installId: metadata.installId,
    slug: metadata.slug,
    version: metadata.version,
    source: metadata.source,
    userSkillId: metadata.userSkillId,
    skillId: metadata.skillId,
    zipUrl: undefined,
  }) : undefined;
  if (installLogContext) {
    logInstallStep(skillStoreLogger, installLogContext, 'metadata upserted', {
      installPath,
    });
  }
  await syncSkillRecord(record, settings, installLogContext);

  return recordToInstallEntry(record);
}

export async function removeLocalSkillRecord(input: unknown): Promise<{ removed: boolean }> {
  const value = input && typeof input === 'object' ? input as { userSkillId?: unknown; slug?: unknown } : {};
  const userSkillId = typeof value.userSkillId === 'number' && value.userSkillId > 0 ? value.userSkillId : undefined;
  const slug = typeof value.slug === 'string' && value.slug.trim() ? value.slug.trim() : undefined;
  const existing = await findLocalSkillRecord(userSkillId, slug);

  if (!existing) {
    return { removed: false };
  }

  const settings = await readSkillStoreSettings();
  await removeSkillLinks(existing, settings);
  await ensureSkillStoreDatabase();
  await runSqlite(`DELETE FROM skills WHERE slug = ${sqlValue(existing.slug)};`);

  return { removed: true };
}

export async function setLocalSkillEnabled(input: unknown): Promise<LocalInstallEntry> {
  const value = input && typeof input === 'object' ? input as { userSkillId?: unknown; slug?: unknown; enabled?: unknown } : {};
  const userSkillId = typeof value.userSkillId === 'number' && value.userSkillId > 0 ? value.userSkillId : undefined;
  const slug = typeof value.slug === 'string' && value.slug.trim() ? value.slug.trim() : undefined;
  const enabled = value.enabled === true;
  const existing = await findLocalSkillRecord(userSkillId, slug);

  if (!existing) {
    throw new Error('LOCAL_SKILL_NOT_FOUND');
  }

  const settings = await readSkillStoreSettings();
  const next: LocalSkillRecord = {
    ...existing,
    enabledClaude: enabled && settings.agents.includes('CLAUDE'),
    enabledCodex: enabled && settings.agents.includes('CODEX'),
    updatedAt: new Date().toISOString(),
  };

  await ensureSkillStoreDatabase();
  await runSqlite(`
UPDATE skills
   SET enabled_claude = ${next.enabledClaude ? 1 : 0},
       enabled_codex = ${next.enabledCodex ? 1 : 0},
       updated_at = ${sqlValue(next.updatedAt)}
 WHERE slug = ${sqlValue(next.slug)};
`);

  await removeSkillLinks(existing, settings);
  if (enabled) {
    await assertSkillCacheExists(next.installPath);
    await syncSkillRecord(next, settings);
  }

  skillStoreLogger.info('skillstack_desktop::store', enabled ? 'local skill enabled' : 'local skill disabled', {
    slug: next.slug,
    userSkillId: next.userSkillId,
    agents: enabled ? settings.agents : [],
    skillSyncMethod: settings.skillSyncMethod,
  });

  return recordToInstallEntry(next);
}

export async function resyncEnabledSkillRecords(previousSettings?: SkillStoreSettings): Promise<{ synced: number }> {
  const startedAt = Date.now();
  const settings = await readSkillStoreSettings();
  const records = await listLocalSkillRecords();
  let synced = 0;

  for (const record of records) {
    if (previousSettings) {
      await removeSkillLinks(record, previousSettings);
    }
    await removeSkillLinks(record, settings);

    if (!record.enabledClaude && !record.enabledCodex) {
      continue;
    }

    try {
      await assertSkillCacheExists(record.installPath);
      await syncSkillRecord(record, settings);
    } catch (error) {
      skillStoreLogger.error('skillstack_desktop::store', 'local skill sync failed', {
        slug: record.slug,
        userSkillId: record.userSkillId,
        agents: getEnabledAgents(record),
        skillSyncMethod: settings.skillSyncMethod,
        error,
      });
      throw error;
    }
    synced += 1;
  }

  skillStoreLogger.info('skillstack_desktop::store', 'enabled local skills resynced', {
    synced,
    agents: settings.agents,
    skillSyncMethod: settings.skillSyncMethod,
  });
  const durationMs = Date.now() - startedAt;
  if (durationMs > slowSyncThresholdMs) {
    skillStoreLogger.warn('skillstack_desktop::store', 'slow local skill resync', {
      synced,
      agents: settings.agents,
      skillSyncMethod: settings.skillSyncMethod,
      durationMs,
      thresholdMs: slowSyncThresholdMs,
    });
  }

  return { synced };
}

export async function getSkillInstallPath(slug: string): Promise<string> {
  const settings = await readSkillStoreSettings();
  return path.join(settings.skillHomeDir, slug);
}

export async function openSkillHomeDir(shellOpenPath: (targetPath: string) => Promise<string>): Promise<{ installDir: string }> {
  const settings = await readSkillStoreSettings();
  await fs.mkdir(settings.skillHomeDir, { recursive: true });
  const openError = await shellOpenPath(settings.skillHomeDir);

  if (openError) {
    throw new Error(openError);
  }

  return { installDir: settings.skillHomeDir };
}

export function normalizeSettings(input: unknown): SkillStoreSettings {
  const defaults = getDefaultSkillStoreSettings();
  const value = input && typeof input === 'object' ? input as Partial<SkillStoreSettings> : {};
  const agent = isAgent(value.agent) ? value.agent : defaults.agent;
  const agents = normalizeAgents(value.agents, agent);
  const skillSyncMethod = value.skillSyncMethod === 'copy' ? 'copy' : 'symlink';

  return {
    agent,
    agents,
    skillStorageLocation: 'skillstack',
    skillSyncMethod,
    apiBaseUrl: normalizeBackendBaseUrl(value.apiBaseUrl, defaults.apiBaseUrl),
    skillHomeDir: normalizePath(value.skillHomeDir, defaults.skillHomeDir),
    claudeSkillsDir: normalizePath(value.claudeSkillsDir, defaults.claudeSkillsDir),
    codexSkillsDir: normalizePath(value.codexSkillsDir, defaults.codexSkillsDir),
  };
}

async function ensureSkillStoreDatabase(): Promise<void> {
  await fs.mkdir(getSkillStackHomeDir(), { recursive: true });
  const columns = await readSkillTableColumns();
  if (columns.length === 0) {
    await runSqlite(createSkillsTableSql('skills'));
    return;
  }
  if (columns.includes('type') || !columns.includes('source')) {
    await migrateSkillStoreSourceColumn(columns);
    return;
  }

  await runSqlite('CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);');
}

async function findLocalSkillRecord(userSkillId?: number, slug?: string): Promise<LocalSkillRecord | null> {
  await ensureSkillStoreDatabase();
  const conditions: string[] = [];
  if (userSkillId) {
    conditions.push(`user_skill_id = ${userSkillId}`);
  }
  if (slug) {
    conditions.push(`slug = ${sqlValue(slug)}`);
  }
  if (conditions.length === 0) {
    return null;
  }

  const sql = `SELECT user_skill_id AS userSkillId,
            source,
            skill_id AS skillId,
            slug,
            name,
            version,
            directory,
            install_path AS installPath,
            installed_at AS installedAt,
            updated_at AS updatedAt,
            enabled_claude AS enabledClaude,
            enabled_codex AS enabledCodex
       FROM skills
      WHERE ${conditions.join(' OR ')}
      LIMIT 1;`;
  const stdout = await runSqlite(sql);
  const rows = stdout.trim() ? JSON.parse(stdout) as Array<Record<string, unknown>> : [];

  return rowToLocalSkillRecord(rows[0]) || null;
}

async function readSkillTableColumns(): Promise<string[]> {
  const stdout = await runSqlite("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'skills';");
  const tables = stdout.trim() ? JSON.parse(stdout) as Array<Record<string, unknown>> : [];
  if (tables.length === 0) {
    return [];
  }

  const columnsOut = await runSqlite('PRAGMA table_info(skills);');
  const columns = columnsOut.trim() ? JSON.parse(columnsOut) as Array<Record<string, unknown>> : [];
  return columns
    .map((column) => typeof column.name === 'string' ? column.name : '')
    .filter(Boolean);
}

async function migrateSkillStoreSourceColumn(columns: string[]): Promise<void> {
  await runSqlite(`
DROP TABLE IF EXISTS skills_new;
${createSkillsTableSql('skills_new')}
DROP TABLE skills;
ALTER TABLE skills_new RENAME TO skills;
CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);
`);
}

function createSkillsTableSql(tableName: string): string {
  return `
CREATE TABLE IF NOT EXISTS ${tableName} (
  user_skill_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'PERSONAL' CHECK(source IN ('PERSONAL', 'TEAM', 'PUBLIC')),
  skill_id INTEGER,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  directory TEXT NOT NULL,
  install_path TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  enabled_claude INTEGER NOT NULL DEFAULT 0,
  enabled_codex INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_skill_id, source)
);
CREATE INDEX IF NOT EXISTS idx_${tableName}_slug ON ${tableName}(slug);
`;
}

async function syncSkillRecord(record: LocalSkillRecord, settings: SkillStoreSettings, installLogContext?: InstallLogContext): Promise<void> {
  await fs.mkdir(settings.skillHomeDir, { recursive: true });
  if (record.enabledClaude) {
    await syncSkillToApp(record, settings.claudeSkillsDir, settings.skillSyncMethod, 'CLAUDE', installLogContext);
  }
  if (record.enabledCodex) {
    await syncSkillToApp(record, settings.codexSkillsDir, settings.skillSyncMethod, 'CODEX', installLogContext);
  }
}

async function syncSkillToApp(
  record: LocalSkillRecord,
  appSkillsDir: string,
  method: SkillStoreSyncMethod,
  agent: SkillStoreAgent,
  installLogContext?: InstallLogContext,
): Promise<void> {
  const startedAt = Date.now();
  if (installLogContext) {
    logInstallStep(skillStoreLogger, installLogContext, `sync to ${agent} started`, {
      targetApp: agent,
      targetPath: path.join(appSkillsDir, record.slug),
      syncMethod: method,
    });
  }

  await fs.mkdir(appSkillsDir, { recursive: true });
  const linkPath = path.join(appSkillsDir, record.slug);
  try {
    await removeExistingSyncPath(linkPath, record.installPath);

    if (method === 'copy') {
      await fs.cp(record.installPath, linkPath, { recursive: true, force: true });
      logSlowSyncIfNeeded(record, agent, linkPath, method, Date.now() - startedAt);
      if (installLogContext) {
        logInstallStep(skillStoreLogger, installLogContext, `sync to ${agent} succeeded`, {
          targetApp: agent,
          targetPath: linkPath,
          syncMethod: method,
        });
      }
      return;
    }

    await fs.symlink(record.installPath, linkPath, 'dir');
    logSlowSyncIfNeeded(record, agent, linkPath, method, Date.now() - startedAt);
    if (installLogContext) {
      logInstallStep(skillStoreLogger, installLogContext, `sync to ${agent} succeeded`, {
        targetApp: agent,
        targetPath: linkPath,
        syncMethod: method,
      });
    }
  } catch (error) {
    if (installLogContext) {
      logInstallStep(skillStoreLogger, installLogContext, `sync to ${agent} failed`, {
        targetApp: agent,
        targetPath: linkPath,
        syncMethod: method,
        error,
      }, 'error');
    }
    throw error;
  }
}

async function removeSkillLinks(record: LocalSkillRecord, settings: SkillStoreSettings): Promise<void> {
  await removeExistingSyncPath(path.join(settings.claudeSkillsDir, record.slug), record.installPath);
  await removeExistingSyncPath(path.join(settings.codexSkillsDir, record.slug), record.installPath);
}

async function removeExistingSyncPath(targetPath: string, expectedRealPath: string): Promise<void> {
  const stat = await lstatIfExists(targetPath);
  if (!stat) {
    return;
  }

  if (stat.isSymbolicLink()) {
    await fs.rm(targetPath, { force: true });
    return;
  }

  if (stat.isDirectory()) {
    const targetRealPath = await fs.realpath(targetPath).catch(() => '');
    const expected = await fs.realpath(expectedRealPath).catch(() => expectedRealPath);
    if (targetRealPath === expected || await hasSkillMarker(targetPath)) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }
  }
}

async function assertSkillCacheExists(installPath: string): Promise<void> {
  const stat = await lstatIfExists(installPath);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('LOCAL_SKILL_CACHE_MISSING');
  }
}

async function hasSkillMarker(directoryPath: string): Promise<boolean> {
  const stat = await lstatIfExists(path.join(directoryPath, 'SKILL.md'));
  return Boolean(stat?.isFile());
}

async function lstatIfExists(filePath: string) {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function normalizeInstallMetadata(input: unknown): SkillInstallMetadata | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const value = input as Partial<SkillInstallMetadata>;
  if (
    typeof value.userSkillId !== 'number'
    || !isSkillSource(value.source)
    || !isValidSlug(value.slug)
    || typeof value.name !== 'string'
    || typeof value.version !== 'string'
    || typeof value.installedAt !== 'string'
    || typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    installId: typeof value.installId === 'string' && value.installId.trim() ? value.installId.trim() : undefined,
    userSkillId: value.userSkillId,
    source: value.source,
    skillId: typeof value.skillId === 'number' ? value.skillId : undefined,
    slug: value.slug,
    name: value.name,
    version: value.version,
    installedAt: value.installedAt,
    updatedAt: value.updatedAt,
  };
}

function rowToLocalSkillRecord(row: Record<string, unknown> | undefined): LocalSkillRecord | null {
  if (!row || typeof row.userSkillId !== 'number' || !isSkillSource(row.source) || !isValidSlug(row.slug)) {
    return null;
  }

  return {
    userSkillId: row.userSkillId,
    source: row.source,
    skillId: typeof row.skillId === 'number' ? row.skillId : undefined,
    slug: row.slug,
    name: typeof row.name === 'string' ? row.name : row.slug,
    version: typeof row.version === 'string' ? row.version : '',
    directory: typeof row.directory === 'string' ? row.directory : row.slug,
    installPath: typeof row.installPath === 'string' ? row.installPath : '',
    installedAt: typeof row.installedAt === 'string' ? row.installedAt : '',
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
    enabledClaude: Boolean(row.enabledClaude),
    enabledCodex: Boolean(row.enabledCodex),
  };
}

function recordToInstallEntry(record: LocalSkillRecord): LocalInstallEntry {
  return {
    userSkillId: record.userSkillId,
    source: record.source,
    skillId: record.skillId,
    slug: record.slug,
    name: record.name,
    version: record.version,
    agent: record.enabledCodex ? 'CODEX' : 'CLAUDE',
    installPath: record.installPath,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
    enabledClaude: record.enabledClaude,
    enabledCodex: record.enabledCodex,
    installSource: 'electron',
  };
}

function getEnabledAgents(record: LocalSkillRecord): SkillStoreAgent[] {
  const agents: SkillStoreAgent[] = [];
  if (record.enabledClaude) {
    agents.push('CLAUDE');
  }
  if (record.enabledCodex) {
    agents.push('CODEX');
  }
  return agents;
}

function buildUpsertSkillSql(record: LocalSkillRecord): string {
  return `
INSERT INTO skills (
  user_skill_id, source, skill_id, slug, name, version, directory, install_path,
  installed_at, updated_at, enabled_claude, enabled_codex
) VALUES (
  ${record.userSkillId},
  ${sqlValue(record.source)},
  ${record.skillId ?? 'NULL'},
  ${sqlValue(record.slug)},
  ${sqlValue(record.name)},
  ${sqlValue(record.version)},
  ${sqlValue(record.directory)},
  ${sqlValue(record.installPath)},
  ${sqlValue(record.installedAt)},
  ${sqlValue(record.updatedAt)},
  ${record.enabledClaude ? 1 : 0},
  ${record.enabledCodex ? 1 : 0}
)
ON CONFLICT(slug) DO UPDATE SET
  user_skill_id = excluded.user_skill_id,
  source = excluded.source,
  skill_id = excluded.skill_id,
  name = excluded.name,
  version = excluded.version,
  directory = excluded.directory,
  install_path = excluded.install_path,
  updated_at = excluded.updated_at,
  enabled_claude = excluded.enabled_claude,
  enabled_codex = excluded.enabled_codex;
`;
}

async function runSqlite(sql: string): Promise<string> {
  const startedAt = Date.now();
  try {
    const { stdout } = await execFileAsync('sqlite3', ['-json', getSkillStoreDatabasePath(), sql], {
      maxBuffer: 1024 * 1024 * 5,
    });
    const durationMs = Date.now() - startedAt;
    if (durationMs > slowSqliteThresholdMs) {
      skillStoreLogger.warn('skillstack_desktop::store', 'slow sqlite operation', {
        operation: getSqliteOperationName(sql),
        durationMs,
        thresholdMs: slowSqliteThresholdMs,
      });
    }
    return stdout;
  } catch (error) {
    skillStoreLogger.error('skillstack_desktop::store', 'sqlite operation failed', {
      operation: getSqliteOperationName(sql),
      error,
    });
    throw error;
  }
}

function logSlowSyncIfNeeded(
  record: LocalSkillRecord,
  agent: SkillStoreAgent,
  targetPath: string,
  method: SkillStoreSyncMethod,
  durationMs: number,
): void {
  if (durationMs <= slowSyncThresholdMs) {
    return;
  }

  skillStoreLogger.warn('skillstack_desktop::store', 'slow local skill sync', {
    slug: record.slug,
    userSkillId: record.userSkillId,
    targetApp: agent,
    targetPath,
    skillSyncMethod: method,
    durationMs,
    thresholdMs: slowSyncThresholdMs,
  });
}

function getSqliteOperationName(sql: string): string {
  const trimmedSql = sql.trim().toUpperCase();
  if (trimmedSql.startsWith('SELECT')) {
    return 'SELECT';
  }
  if (trimmedSql.startsWith('INSERT')) {
    return 'INSERT';
  }
  if (trimmedSql.startsWith('UPDATE')) {
    return 'UPDATE';
  }
  if (trimmedSql.startsWith('DELETE')) {
    return 'DELETE';
  }
  if (trimmedSql.startsWith('CREATE')) {
    return 'CREATE';
  }
  if (trimmedSql.startsWith('DROP')) {
    return 'MIGRATION';
  }
  return 'SQL';
}

function sqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizePath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return path.resolve(expandHomeDir(value.trim()));
}

function normalizeBackendBaseUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fallback;
    }

    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function expandHomeDir(value: string): string {
  if (value === '~') {
    return getUserHomeDir();
  }
  if (value.startsWith(`~${path.sep}`)) {
    return path.join(getUserHomeDir(), value.slice(2));
  }
  return value;
}

function getUserHomeDir(): string {
  return process.env.SKILLSTACK_USER_HOME
    ? path.resolve(process.env.SKILLSTACK_USER_HOME)
    : os.homedir();
}

function isAgent(value: unknown): value is SkillStoreAgent {
  return typeof value === 'string' && supportedAgents.includes(value as SkillStoreAgent);
}

function normalizeAgents(value: unknown, fallback: SkillStoreAgent): SkillStoreAgent[] {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const agents = supportedAgents.filter((agent) => value.includes(agent));
  return agents.length > 0 ? agents : [fallback];
}

function isSkillSource(value: unknown): value is SkillStoreUserSkillSource {
  return typeof value === 'string' && supportedSkillSources.includes(value as SkillStoreUserSkillSource);
}

function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value) && value !== '.' && value !== '..';
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
