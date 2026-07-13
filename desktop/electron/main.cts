import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { proxyApiRequest } from './apiProxy';
import { createInstallLogContext, logInstallStep, type InstallLogContext } from './installLogging';
import { shouldLogDesktopOperationSuccess } from './ipcLogging';
import { exportDesktopLogs } from './logExport';
import {
  buildStartupEnvironmentSnapshot,
  getDesktopLogger,
  getDesktopLogFilePath,
  sanitizeUrlForLog,
  serializeErrorForLog,
  type LogLevel,
} from './logger';
import { extractSkillPackage } from './skillPackage';
import {
  getSkillStoreDatabasePath,
  getSkillStoreSettingsPath,
  getSkillInstallPath,
  listLocalInstalls,
  openSkillHomeDir,
  readSkillStoreSettings,
  removeLocalSkillRecord,
  resyncEnabledSkillRecords,
  saveSkillStoreSettings,
  setSkillStoreLogger,
  setLocalSkillEnabled,
  upsertLocalSkillRecord,
  type LocalInstallEntry,
  type SkillStoreAgent as Agent,
  type SkillStoreSettings,
  type SkillStoreUserSkillSource as UserSkillSource,
} from './skillStore';

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const supportedAgents = ['CLAUDE', 'CODEX'] as const;
const supportedUserSkillSources = ['PERSONAL', 'TEAM', 'PUBLIC'] as const;
const desktopLogger = getDesktopLogger();
const appSessionId = `app_${randomUUID()}`;
setSkillStoreLogger(desktopLogger);

type DesktopSkill = {
  slug: string;
  name: string;
  version: string;
  installPath: string;
  updatedAt: string;
};

type PickedSkillFile = {
  name: string;
  path: string;
  data: ArrayBuffer;
};

type InstallSkillInput = {
  userSkillId?: unknown;
  source?: unknown;
  skillId?: unknown;
  slug?: unknown;
  name?: unknown;
  version?: unknown;
  zipUrl?: unknown;
  authToken?: unknown;
  headers?: unknown;
};

type NormalizedInstallSkillInput = {
  userSkillId: number;
  source: UserSkillSource;
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  zipUrl: string;
  authToken?: string;
  headers: Record<string, string>;
};

type DesktopResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
type WindowMode = 'login' | 'app';
type DesktopLogEvent = {
  level?: unknown;
  moduleName?: unknown;
  message?: unknown;
  fields?: unknown;
};
const allowedRendererLogModules = new Set([
  'skillstack_desktop::renderer',
  'skillstack_desktop::renderer_api',
]);

const loginWindowSize = {
  width: 640,
  height: 440,
  minWidth: 640,
  minHeight: 440,
};
const slowInstallThresholdMs = 10000;
const appWindowSize = {
  width: 1180,
  height: 760,
  minWidth: 960,
  minHeight: 640,
};

function createOkResult<T>(data: T): DesktopResult<T> {
  return {
    ok: true,
    data,
  };
}

function createErrorResult(code: string, message: string): DesktopResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function isUserSkillSource(value: unknown): value is UserSkillSource {
  return typeof value === 'string' && supportedUserSkillSources.includes(value as UserSkillSource);
}

function expandHomeDir(value: string): string {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value) && value !== '.' && value !== '..';
}

async function scanInstalledSkills(): Promise<DesktopSkill[]> {
  const settings = await readSkillStoreSettings();
  const installDir = path.resolve(expandHomeDir(settings.skillHomeDir));

  try {
    const entries = await fs.readdir(installDir, { withFileTypes: true });
    const skills: DesktopSkill[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(installDir, entry.name);
      const skillFilePath = path.join(skillDir, 'SKILL.md');
      const skillFileStat = await statIfExists(skillFilePath);

      if (!skillFileStat?.isFile()) {
        continue;
      }

      const skillFileContent = await fs.readFile(skillFilePath, 'utf8');
      const metadata = parseSkillMetadata(skillFileContent);
      const skillDirStat = await fs.stat(skillDir);

      skills.push({
        slug: entry.name,
        name: metadata.name || entry.name,
        version: metadata.version,
        installPath: skillDir,
        updatedAt: skillDirStat.mtime.toISOString(),
      });
    }

    return skills.sort((left, right) => left.slug.localeCompare(right.slug));
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function uninstallSkill(slug: unknown): Promise<{ slug: string }> {
  if (!isValidSlug(slug)) {
    throw new Error('INVALID_SKILL_SLUG');
  }

  const settings = await readSkillStoreSettings();
  const installDir = path.resolve(expandHomeDir(settings.skillHomeDir));
  const targetPath = path.resolve(installDir, slug);
  const installDirRealPath = await ensureDirectoryRealPath(installDir);
  const targetParentRealPath = await fs.realpath(path.dirname(targetPath));
  const targetStat = await fs.lstat(targetPath);

  if (targetParentRealPath !== installDirRealPath || path.dirname(targetPath) !== installDir) {
    throw new Error('SKILL_PATH_OUTSIDE_INSTALL_DIR');
  }

  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
    throw new Error('SKILL_PATH_NOT_DIRECTORY');
  }

  await fs.rm(targetPath, { recursive: true, force: false });
  await removeLocalSkillRecord({ slug });

  return { slug };
}

async function installSkill(input: unknown): Promise<DesktopSkill> {
  const installInput = normalizeInstallSkillInput(input);
  const installLogContext = createInstallLogContext({
    slug: installInput.slug,
    version: installInput.version,
    source: installInput.source,
    userSkillId: installInput.userSkillId,
    skillId: installInput.skillId,
    zipUrl: installInput.zipUrl,
  });
  const installDir = path.dirname(await getSkillInstallPath(installInput.slug));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillstack-install-'));
  const tempZipPath = path.join(tempDir, 'skill.zip');
  const extractDir = path.join(tempDir, 'extract');
  let stagingPath = '';
  let backupPath = '';

  try {
    logInstallStep(desktopLogger, installLogContext, 'install started', {
      syncMethod: (await readSkillStoreSettings()).skillSyncMethod,
    });
    await downloadOrCopySkillZip(installInput, tempZipPath, installLogContext);
    await fs.mkdir(extractDir, { recursive: true });
    await extractSkillPackage(tempZipPath, extractDir);
    logInstallStep(desktopLogger, installLogContext, 'package extracted', {
      extractDir,
    });

    const installDirRealPath = await ensureDirectoryRealPath(installDir);
    const targetPath = path.resolve(installDir, installInput.slug);
    const targetParentRealPath = await fs.realpath(path.dirname(targetPath));

    if (targetParentRealPath !== installDirRealPath || path.dirname(targetPath) !== installDir) {
      throw new Error('SKILL_PATH_OUTSIDE_INSTALL_DIR');
    }

    stagingPath = await createInstallStagingPath(installDir, installInput.slug);
    backupPath = path.join(installDir, `.${installInput.slug}.backup-${Date.now()}`);
    logInstallStep(desktopLogger, installLogContext, 'staging created', {
      stagingPath,
      installPath: targetPath,
    });

    await fs.cp(extractDir, stagingPath, { recursive: true, force: false, errorOnExist: true });
    await replaceSkillDirectory(targetPath, stagingPath, backupPath);
    logInstallStep(desktopLogger, installLogContext, 'directory replaced', {
      stagingPath,
      installPath: targetPath,
    });

    const installedStat = await fs.stat(targetPath);
    const updatedAt = installedStat.mtime.toISOString();
    await upsertLocalSkillRecord({
      installId: installLogContext.installId,
      userSkillId: installInput.userSkillId,
      source: installInput.source,
      skillId: installInput.skillId,
      slug: installInput.slug,
      name: installInput.name,
      version: installInput.version,
      installedAt: updatedAt,
      updatedAt,
    });
    logInstallStep(desktopLogger, installLogContext, 'install succeeded', {
      installPath: targetPath,
    });

    return {
      slug: installInput.slug,
      name: installInput.name,
      version: installInput.version,
      installPath: targetPath,
      updatedAt,
    };
  } catch (error) {
    if (stagingPath) {
      await fs.rm(stagingPath, { recursive: true, force: true });
    }

    logInstallStep(desktopLogger, installLogContext, 'install failed', {
      error,
    }, 'error');
    throw normalizeInstallError(error);
  } finally {
    if (backupPath) {
      await fs.rm(backupPath, { recursive: true, force: true });
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function openInstallDir(): Promise<{ installDir: string }> {
  return openSkillHomeDir((targetPath) => shell.openPath(targetPath));
}

async function saveConfigAndResync(input: unknown): Promise<SkillStoreSettings> {
  const previousSettings = await readSkillStoreSettings();
  const settings = await saveSkillStoreSettings(input);
  await resyncEnabledSkillRecords(previousSettings);
  return settings;
}

async function pickSkillFile(sender: WebContents): Promise<PickedSkillFile | null> {
  const window = BrowserWindow.fromWebContents(sender);
  if (!window) {
    throw new Error('WINDOW_NOT_FOUND');
  }

  const result = await dialog.showOpenDialog(window, {
    title: '选择 Skill 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Skill 文件', extensions: ['zip', 'md'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    data: content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  };
}

async function ensureDirectoryRealPath(directoryPath: string): Promise<string> {
  await fs.mkdir(directoryPath, { recursive: true });
  return fs.realpath(directoryPath);
}

async function downloadOrCopySkillZip(input: NormalizedInstallSkillInput, targetPath: string, installLogContext: InstallLogContext): Promise<void> {
  const localPath = parseLocalZipPath(input.zipUrl);

  if (localPath) {
    try {
      logInstallStep(desktopLogger, installLogContext, 'local package copy started', {
        localPackagePath: localPath,
      });
      await fs.copyFile(localPath, targetPath);
      const copiedStat = await fs.stat(targetPath);
      logInstallStep(desktopLogger, installLogContext, 'local package copied', {
        source: 'local',
        localPackagePath: localPath,
        bytes: copiedStat.size,
      });
      return;
    } catch (error) {
      logInstallStep(desktopLogger, installLogContext, 'local package copy failed', {
        source: 'local',
        localPackagePath: localPath,
        error,
      }, 'error');
      throw createWrappedError('DOWNLOAD_FAILED', 'Failed to copy local skill package.', error);
    }
  }

  if (!isHttpUrl(input.zipUrl)) {
    logInstallStep(desktopLogger, installLogContext, 'skill package download failed', {
      reason: 'invalid_url',
    }, 'error');
    throw new Error('DOWNLOAD_FAILED');
  }

  try {
    const headers = buildDownloadHeaders(input);
    logInstallStep(desktopLogger, installLogContext, 'remote package download started', {
      zipUrl: input.zipUrl,
    });
    const response = await fetch(input.zipUrl, { headers });

    if (!response.ok) {
      logInstallStep(desktopLogger, installLogContext, 'skill package download failed', {
        status: response.status,
        zipUrl: input.zipUrl,
      }, 'error');
      throw new Error(`DOWNLOAD_HTTP_${response.status}: ${input.zipUrl}`);
    }

    const zipContent = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(targetPath, zipContent);
    logInstallStep(desktopLogger, installLogContext, 'remote package downloaded', {
      bytes: zipContent.byteLength,
      zipUrl: input.zipUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DOWNLOAD_HTTP_')) {
      throw error;
    }
    logInstallStep(desktopLogger, installLogContext, 'skill package download failed', {
      zipUrl: input.zipUrl,
      error,
    }, 'error');
    throw createWrappedError('DOWNLOAD_FAILED', 'Failed to download skill package.', error);
  }
}

async function createInstallStagingPath(installDir: string, slug: string): Promise<string> {
  return fs.mkdtemp(path.join(installDir, `.${slug}.staging-`));
}

async function replaceSkillDirectory(targetPath: string, stagingPath: string, backupPath: string): Promise<void> {
  const targetStat = await lstatIfExists(targetPath);

  try {
    if (targetStat) {
      if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
        throw new Error('SKILL_PATH_NOT_DIRECTORY');
      }

      await fs.rename(targetPath, backupPath);
    }

    await fs.rename(stagingPath, targetPath);
  } catch (error) {
    if (await pathExists(targetPath)) {
      await fs.rm(stagingPath, { recursive: true, force: true });
    } else if (await pathExists(backupPath)) {
      await fs.rename(backupPath, targetPath);
    }

    throw createWrappedError('INSTALL_FAILED', 'Failed to install skill package.', error);
  }
}

async function statIfExists(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
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

async function pathExists(filePath: string): Promise<boolean> {
  return Boolean(await lstatIfExists(filePath));
}

function parseSkillMetadata(content: string): { name: string; version: string } {
  const frontMatter = parseFrontMatter(content);
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';

  return {
    name: frontMatter.name || title,
    version: frontMatter.version || '',
  };
}

function parseFrontMatter(content: string): Record<string, string> {
  const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!frontMatterMatch) {
    return {};
  }

  const metadata: Record<string, string> = {};

  for (const line of frontMatterMatch[1].split(/\r?\n/)) {
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);

    if (!fieldMatch) {
      continue;
    }

    metadata[fieldMatch[1]] = trimYamlScalar(fieldMatch[2]);
  }

  return metadata;
}

function trimYamlScalar(value: string): string {
  const trimmedValue = value.trim();

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"'))
    || (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function normalizeInstallSkillInput(input: unknown): NormalizedInstallSkillInput {
  const value = input && typeof input === 'object' ? input as InstallSkillInput : {};

  if (!isValidSlug(value.slug)) {
    throw new Error('INVALID_SKILL_SLUG');
  }

  if (typeof value.userSkillId !== 'number' || value.userSkillId <= 0 || !isUserSkillSource(value.source)) {
    throw new Error('INVALID_LOCAL_INSTALL');
  }

  if (typeof value.zipUrl !== 'string' || !value.zipUrl.trim()) {
    throw new Error('EMPTY_ZIP_URL');
  }

  return {
    userSkillId: value.userSkillId,
    source: value.source,
    skillId: typeof value.skillId === 'number' ? value.skillId : undefined,
    slug: value.slug,
    name: typeof value.name === 'string' ? value.name : '',
    version: typeof value.version === 'string' ? value.version : '',
    zipUrl: value.zipUrl.trim(),
    authToken: typeof value.authToken === 'string' && value.authToken.trim() ? value.authToken.trim() : undefined,
    headers: normalizeHeaders(value.headers),
  };
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }

  const normalizedHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalizedHeaders[key] = value;
    }
  }

  return normalizedHeaders;
}

function buildDownloadHeaders(input: { authToken?: string; headers: Record<string, string> }): Record<string, string> {
  const headers = { ...input.headers };
  const hasAuthorizationHeader = Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');

  if (input.authToken && !hasAuthorizationHeader) {
    headers.Authorization = `Bearer ${input.authToken}`;
  }

  return headers;
}

function parseLocalZipPath(zipUrl: string): string | null {
  if (path.isAbsolute(zipUrl)) {
    return zipUrl;
  }

  if (!zipUrl.startsWith('file://')) {
    return null;
  }

  try {
    return fileURLToPath(zipUrl);
  } catch {
    throw new Error('DOWNLOAD_FAILED');
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function createWrappedError(code: string, message: string, cause: unknown): Error {
  const error = new Error(code);
  error.cause = cause instanceof Error ? cause : new Error(message);
  return error;
}

function normalizeInstallError(error: unknown): unknown {
  if (error instanceof Error) {
    if (
      error.message === 'INVALID_SKILL_SLUG'
      || error.message === 'EMPTY_ZIP_URL'
      || error.message === 'DOWNLOAD_FAILED'
      || error.message.startsWith('DOWNLOAD_HTTP_')
      || error.message === 'INVALID_SKILL_PACKAGE'
      || error.message === 'INSTALL_FAILED'
      || error.message === 'SKILL_PATH_OUTSIDE_INSTALL_DIR'
      || error.message === 'SKILL_PATH_NOT_DIRECTORY'
    ) {
      return error;
    }

    return createWrappedError('INSTALL_FAILED', 'Failed to install skill package.', error);
  }

  return new Error('INSTALL_FAILED');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function toDesktopError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    if (error.message === 'INVALID_SKILL_SLUG') {
      return {
        code: 'INVALID_SKILL_SLUG',
        message: 'Skill slug is invalid.',
      };
    }

    if (error.message === 'EMPTY_ZIP_URL') {
      return {
        code: 'EMPTY_ZIP_URL',
        message: 'Skill zip URL is required.',
      };
    }

    if (error.message === 'DOWNLOAD_FAILED') {
      return {
        code: 'DOWNLOAD_FAILED',
        message: 'Failed to download skill package.',
      };
    }

    if (error.message.startsWith('DOWNLOAD_HTTP_')) {
      return {
        code: 'DOWNLOAD_FAILED',
        message: error.message,
      };
    }

    if (error.message === 'INVALID_SKILL_PACKAGE') {
      return {
        code: 'INVALID_SKILL_PACKAGE',
        message: 'Skill package must contain SKILL.md at the root or inside a single top-level directory.',
      };
    }

    if (error.message === 'INSTALL_FAILED') {
      return {
        code: 'INSTALL_FAILED',
        message: 'Failed to install skill package.',
      };
    }

    if (error.message === 'SKILL_PATH_OUTSIDE_INSTALL_DIR') {
      return {
        code: 'SKILL_PATH_OUTSIDE_INSTALL_DIR',
        message: 'Skill path is outside install directory.',
      };
    }

    if (error.message === 'SKILL_PATH_NOT_DIRECTORY') {
      return {
        code: 'SKILL_PATH_NOT_DIRECTORY',
        message: 'Skill path is not a directory.',
      };
    }

    if (error.message === 'INVALID_LOCAL_INSTALL') {
      return {
        code: 'INVALID_LOCAL_INSTALL',
        message: 'Local install metadata is invalid.',
      };
    }

    if (error.message === 'LOCAL_SKILL_NOT_FOUND') {
      return {
        code: 'LOCAL_SKILL_NOT_FOUND',
        message: 'Local skill record was not found.',
      };
    }

    if (error.message === 'LOCAL_SKILL_CACHE_MISSING') {
      return {
        code: 'LOCAL_SKILL_CACHE_MISSING',
        message: 'Local skill cache is missing.',
      };
    }

    return {
      code: 'DESKTOP_OPERATION_FAILED',
      message: error.message,
    };
  }

  return {
    code: 'DESKTOP_OPERATION_FAILED',
    message: 'Desktop operation failed.',
  };
}

function handleDesktopOperation<T>(operationName: string, operation: () => Promise<T>): Promise<DesktopResult<T>> {
  const startedAt = Date.now();
  return operation()
    .then((data) => {
      const durationMs = Date.now() - startedAt;
      if (shouldLogDesktopOperationSuccess(operationName)) {
        desktopLogger.info('skillstack_desktop::ipc', 'desktop operation completed', {
          operation: operationName,
          durationMs,
        });
      }
      if (operationName === 'skills:install' && durationMs > slowInstallThresholdMs) {
        desktopLogger.warn('skillstack_desktop::install', 'slow install operation', {
          operation: operationName,
          durationMs,
          thresholdMs: slowInstallThresholdMs,
        });
      }
      return createOkResult(data);
    })
    .catch((error: unknown) => {
      const desktopError = toDesktopError(error);
      desktopLogger.error('skillstack_desktop::ipc', 'desktop operation failed', {
        operation: operationName,
        durationMs: Date.now() - startedAt,
        errorCode: desktopError.code,
        error: serializeErrorForLog(error),
      });
      return createErrorResult(desktopError.code, desktopError.message);
    });
}

function registerDesktopIpcHandlers() {
  ipcMain.handle('skillstack:config:get', () => handleDesktopOperation('config:get', readSkillStoreSettings));
  ipcMain.handle('skillstack:config:save', (_event, input: unknown) => handleDesktopOperation('config:save', () => saveConfigAndResync(input)));
  ipcMain.handle('skillstack:local-installs:list', () => handleDesktopOperation('local-installs:list', listLocalInstalls));
  ipcMain.handle('skillstack:local-installs:upsert', (_event, input: unknown) => handleDesktopOperation('local-installs:upsert', () => upsertLocalSkillRecord(input)));
  ipcMain.handle('skillstack:local-installs:remove', (_event, input: unknown) => handleDesktopOperation('local-installs:remove', () => removeLocalSkillRecord(input)));
  ipcMain.handle('skillstack:local-installs:set-enabled', (_event, input: unknown) => handleDesktopOperation('local-installs:set-enabled', () => setLocalSkillEnabled(input)));
  ipcMain.handle('skillstack:skills:scan', () => handleDesktopOperation('skills:scan', scanInstalledSkills));
  ipcMain.handle('skillstack:skills:install', (_event, input: unknown) => handleDesktopOperation('skills:install', () => installSkill(input)));
  ipcMain.handle('skillstack:skills:uninstall', (_event, slug: unknown) => handleDesktopOperation('skills:uninstall', () => uninstallSkill(slug)));
  ipcMain.handle('skillstack:skill-file:pick', (event) => handleDesktopOperation('skill-file:pick', () => pickSkillFile(event.sender)));
  ipcMain.handle('skillstack:install-dir:open', () => handleDesktopOperation('install-dir:open', openInstallDir));
  ipcMain.handle('skillstack:window:mode', (event, mode: unknown) => handleDesktopOperation('window:mode', () => setWindowMode(event.sender, mode)));
  ipcMain.handle('skillstack:api:request', (_event, input: unknown) => handleDesktopOperation('api:request', () => handleApiProxyRequest(input)));
  ipcMain.handle('skillstack:log:event', (_event, input: unknown) => handleDesktopOperation('log:event', () => logRendererEvent(input)));
  ipcMain.handle('skillstack:logs:export', () => handleDesktopOperation('logs:export', exportLogs));
}

async function handleApiProxyRequest(input: unknown) {
  const settings = await readSkillStoreSettings();
  return proxyApiRequest(input, settings.apiBaseUrl, fetch, {
    logger: desktopLogger,
    requestId: extractRequestId(input),
  });
}

async function logRendererEvent(input: unknown): Promise<{ logged: boolean }> {
  const event = normalizeDesktopLogEvent(input);
  desktopLogger[event.level](event.moduleName, event.message, event.fields);
  return { logged: true };
}

async function exportLogs(): Promise<{ filePath: string; files: string[] }> {
  const settings = await readSkillStoreSettings();
  const environmentSummary = buildStartupEnvironmentSnapshot({
    appSessionId,
    appVersion: app.getVersion(),
    isDev,
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron || '',
    nodeVersion: process.versions.node,
    logFilePath: getDesktopLogFilePath(),
    settingsPath: getSkillStoreSettingsPath(),
    databasePath: getSkillStoreDatabasePath(),
    settings,
  });

  const result = await exportDesktopLogs({
    logsDir: path.dirname(getDesktopLogFilePath()),
    outputDir: app.getPath('downloads'),
    environmentSummary,
    settingsSummary: {
      agents: settings.agents,
      skillSyncMethod: settings.skillSyncMethod,
      apiBaseUrl: settings.apiBaseUrl,
      skillHomeDir: settings.skillHomeDir,
      claudeSkillsDir: settings.claudeSkillsDir,
      codexSkillsDir: settings.codexSkillsDir,
    },
  });

  desktopLogger.info('skillstack_desktop::logs', 'desktop logs exported', {
    filePath: result.filePath,
    files: result.files,
  });

  return result;
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: loginWindowSize.width,
    height: loginWindowSize.height,
    minWidth: loginWindowSize.minWidth,
    minHeight: loginWindowSize.minHeight,
    title: 'SkillStack',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fff',
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    desktopLogger.info('skillstack_desktop::window', 'external url opened', {
      url: sanitizeUrlForLog(url),
    });
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    desktopLogger.error('skillstack_desktop::window', 'renderer load failed', {
      errorCode,
      errorDescription,
      url: sanitizeUrlForLog(validatedUrl),
    });
  });

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  desktopLogger.info('skillstack_desktop::window', 'main window created', {
    mode: isDev ? 'dev' : 'packaged',
    logFilePath: getDesktopLogFilePath(),
  });
}

async function setWindowMode(sender: WebContents, mode: unknown): Promise<{ mode: WindowMode }> {
  if (mode !== 'login' && mode !== 'app') {
    throw new Error('INVALID_WINDOW_MODE');
  }

  const window = BrowserWindow.fromWebContents(sender);
  if (!window) {
    throw new Error('WINDOW_NOT_FOUND');
  }

  const size = mode === 'login' ? loginWindowSize : appWindowSize;
  window.setResizable(mode === 'app');
  window.setMaximizable(mode === 'app');
  window.setMinimumSize(size.minWidth, size.minHeight);
  window.setMaximumSize(mode === 'login' ? size.width : 10000, mode === 'login' ? size.height : 10000);
  window.setBounds({
    width: size.width,
    height: size.height,
  }, false);
  window.center();
  if (window.isMinimized()) {
    window.restore();
  }
  if (!window.isVisible()) {
    window.show();
  }
  app.focus();
  window.focus();

  return { mode };
}

app.whenReady().then(async () => {
  const settings = await readSkillStoreSettings();
  desktopLogger.info('skillstack_desktop::lifecycle', 'app ready', buildStartupEnvironmentSnapshot({
    appSessionId,
    appVersion: app.getVersion(),
    isDev,
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron || '',
    nodeVersion: process.versions.node,
    logFilePath: getDesktopLogFilePath(),
    settingsPath: getSkillStoreSettingsPath(),
    databasePath: getSkillStoreDatabasePath(),
    settings,
  }));
  registerDesktopIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    desktopLogger.info('skillstack_desktop::lifecycle', 'app activated');
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  desktopLogger.info('skillstack_desktop::lifecycle', 'app before quit');
});

app.on('window-all-closed', () => {
  desktopLogger.info('skillstack_desktop::lifecycle', 'all windows closed');
  if (process.platform !== 'darwin') app.quit();
});

function normalizeDesktopLogEvent(input: unknown): Required<DesktopLogEvent> & { level: LogLevel; moduleName: string; message: string; fields: Record<string, unknown> } {
  const value = input && typeof input === 'object' ? input as DesktopLogEvent : {};
  const level = isLogLevel(value.level) ? value.level : 'info';
  const moduleName = typeof value.moduleName === 'string' && value.moduleName.trim()
    ? normalizeRendererLogModule(value.moduleName.trim())
    : 'skillstack_desktop::renderer';
  const message = typeof value.message === 'string' && value.message.trim()
    ? value.message.trim()
    : 'renderer log event';
  const fields = value.fields && typeof value.fields === 'object' && !Array.isArray(value.fields)
    ? value.fields as Record<string, unknown>
    : {};

  return {
    level,
    moduleName,
    message,
    fields,
  };
}

function normalizeRendererLogModule(moduleName: string): string {
  return allowedRendererLogModules.has(moduleName) ? moduleName : 'skillstack_desktop::renderer';
}

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function extractRequestId(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const requestId = (input as { requestId?: unknown }).requestId;
  return typeof requestId === 'string' && requestId.trim() ? requestId.trim() : undefined;
}
