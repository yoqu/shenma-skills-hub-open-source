import type { UserSkillItemRes } from '@/api/endpoints';
import { getToken, normalizeApiBaseUrl, resolveApiAssetUrl, resolveSkillDownloadUrl, setApiBaseUrl } from '@/api/client';
import { readLocalInstalls, removeLocalInstall, setFallbackLocalEnabled, upsertLocalInstall } from './localInstallStore';
import type { DesktopAgent, LocalInstallEntry } from './types';

export interface DesktopSettings {
  agent: DesktopAgent;
  agents: DesktopAgent[];
  skillStorageLocation: 'skillstack';
  skillSyncMethod: 'symlink' | 'copy';
  apiBaseUrl: string;
  skillHomeDir: string;
  claudeSkillsDir: string;
  codexSkillsDir: string;
}

export type DesktopLogExportResult = {
  filePath: string;
  files: string[];
};

const FALLBACK_SETTINGS_KEY = 'skillstack.desktop.settings.v1';

type ConfigDesktopAgent = 'CLAUDE' | 'CODEX';

export const defaultDesktopSettings: DesktopSettings = {
  agent: 'CLAUDE',
  agents: ['CLAUDE'],
  skillStorageLocation: 'skillstack',
  skillSyncMethod: 'symlink',
  apiBaseUrl: 'http://localhost:8080',
  skillHomeDir: '~/.skillstack/skills',
  claudeSkillsDir: '~/.claude/skills',
  codexSkillsDir: '~/.codex/skills',
};

export function getDesktopApi() {
  return typeof window === 'undefined' ? undefined : window.skillstackDesktop;
}

export function hasDesktopApi(): boolean {
  return Boolean(getDesktopApi());
}

export async function scanLocalSkills(_cloudItems: UserSkillItemRes[] = []): Promise<LocalInstallEntry[]> {
  const api = getDesktopApi();
  if (api?.listLocalInstalls) {
    const result = await api.listLocalInstalls();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  }

  return readLocalInstalls();
}

export async function installDesktopSkill(cloud: UserSkillItemRes): Promise<void> {
  const api = getDesktopApi();
  const version = isAddedSource(cloud.source) ? cloud.publicVersion || cloud.version : cloud.version;
  const token = getToken();
  const packageUrl = resolveDesktopPackageUrl(cloud, version);

  if (api) {
    const result = await api.installSkill({
      userSkillId: cloud.id,
      source: cloud.source,
      skillId: cloud.skillId,
      slug: cloud.slug,
      name: cloud.name,
      version,
      zipUrl: packageUrl,
      authToken: token || undefined,
    });
    if (!result.ok) throw new Error(result.error.message);
    return;
  }

  const now = new Date().toISOString();
  upsertLocalInstall({
    userSkillId: cloud.id,
    source: cloud.source,
    skillId: cloud.skillId,
    slug: cloud.slug,
    name: cloud.name,
    version,
    agent: 'CLAUDE',
    installPath: `~/.claude/skills/${cloud.slug}`,
    installedAt: now,
    updatedAt: now,
    enabledClaude: true,
    enabledCodex: false,
    installSource: 'fallback',
  });
}

function resolveDesktopPackageUrl(cloud: UserSkillItemRes, version?: string | null): string {
  if (isAddedSource(cloud.source)) {
    return resolveSkillDownloadUrl(cloud.slug);
  }

  return resolveApiAssetUrl(cloud.zipUrl);
}

function isAddedSource(source: string | undefined): boolean {
  return source === 'TEAM' || source === 'PUBLIC';
}

export async function uninstallDesktopSkill(slug: string, userSkillId?: number): Promise<void> {
  const api = getDesktopApi();
  if (api) {
    const result = await api.uninstallSkill(slug);
    if (!result.ok) throw new Error(result.error.message);
    const recordResult = await api.removeLocalInstall({ userSkillId, slug });
    if (!recordResult.ok) throw new Error(recordResult.error.message);
    return;
  }

  removeLocalInstall(userSkillId, slug);
}

export async function setDesktopSkillEnabled(slug: string, userSkillId: number | undefined, enabled: boolean): Promise<void> {
  const api = getDesktopApi();
  if (api) {
    if (!api.setLocalSkillEnabled) {
      throw new Error('Desktop set-enabled API is unavailable.');
    }
    const result = await api.setLocalSkillEnabled({ userSkillId, slug, enabled });
    if (!result.ok) throw new Error(result.error.message);
    return;
  }

  setFallbackLocalEnabled(userSkillId, slug, enabled);
}

export async function readDesktopSettings(): Promise<DesktopSettings> {
  const api = getDesktopApi();
  if (api) {
    const result = await api.getConfig();
    if (!result.ok) throw new Error(result.error.message);
    return applyDesktopSettings({
      agent: normalizeAgent(result.data.agent),
      agents: normalizeAgents(result.data.agents, normalizeAgent(result.data.agent)),
      skillStorageLocation: result.data.skillStorageLocation,
      skillSyncMethod: result.data.skillSyncMethod,
      apiBaseUrl: result.data.apiBaseUrl,
      skillHomeDir: result.data.skillHomeDir,
      claudeSkillsDir: result.data.claudeSkillsDir,
      codexSkillsDir: result.data.codexSkillsDir,
    });
  }

  return applyDesktopSettings(readFallbackSettings());
}

export async function saveDesktopSettings(settings: DesktopSettings): Promise<DesktopSettings> {
  const api = getDesktopApi();
  if (api) {
    const result = await api.saveConfig({
      agent: settings.agent,
      agents: settings.agents,
      skillStorageLocation: settings.skillStorageLocation,
      skillSyncMethod: settings.skillSyncMethod,
      apiBaseUrl: settings.apiBaseUrl,
      skillHomeDir: settings.skillHomeDir,
      claudeSkillsDir: settings.claudeSkillsDir,
      codexSkillsDir: settings.codexSkillsDir,
    });
    if (!result.ok) throw new Error(result.error.message);
    return applyDesktopSettings({
      agent: normalizeAgent(result.data.agent),
      agents: normalizeAgents(result.data.agents, normalizeAgent(result.data.agent)),
      skillStorageLocation: result.data.skillStorageLocation,
      skillSyncMethod: result.data.skillSyncMethod,
      apiBaseUrl: result.data.apiBaseUrl,
      skillHomeDir: result.data.skillHomeDir,
      claudeSkillsDir: result.data.claudeSkillsDir,
      codexSkillsDir: result.data.codexSkillsDir,
    });
  }

  localStorage.setItem(FALLBACK_SETTINGS_KEY, JSON.stringify(settings));
  return applyDesktopSettings(settings);
}

export async function initializeDesktopSettings(): Promise<DesktopSettings> {
  return readDesktopSettings();
}

export async function openDesktopInstallDir(): Promise<void> {
  const api = getDesktopApi();
  if (!api) return;

  const result = await api.openInstallDir();
  if (!result.ok) throw new Error(result.error.message);
}

export async function exportDesktopLogs(): Promise<DesktopLogExportResult> {
  const api = getDesktopApi();
  if (!api?.exportLogs) {
    throw new Error('Desktop log export is unavailable.');
  }

  const result = await api.exportLogs();
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function testDesktopBackendConnection(apiBaseUrl: string): Promise<void> {
  const testUrl = resolveConnectionTestUrl(apiBaseUrl);
  if (!testUrl) {
    throw new Error('后端地址格式不正确');
  }

  const api = getDesktopApi();
  if (api?.apiRequest) {
    const result = await api.apiRequest({
      apiBaseUrl,
      method: 'GET',
      url: '/site/branding',
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    if (result.data.status < 200 || result.data.status >= 300) {
      throw new Error(`HTTP ${result.data.status}`);
    }
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function readFallbackSettings(): DesktopSettings {
  try {
    const raw = localStorage.getItem(FALLBACK_SETTINGS_KEY);
    if (!raw) return defaultDesktopSettings;
    const saved = { ...defaultDesktopSettings, ...JSON.parse(raw) };
    return {
      ...saved,
      agent: normalizeAgent(saved.agent),
      agents: normalizeAgents(saved.agents, normalizeAgent(saved.agent)),
    };
  } catch {
    return defaultDesktopSettings;
  }
}

function normalizeAgent(agent: ConfigDesktopAgent): DesktopAgent {
  return agent === 'CODEX' ? 'CODEX' : 'CLAUDE';
}

function normalizeAgents(agents: unknown, fallback: DesktopAgent): DesktopAgent[] {
  if (!Array.isArray(agents)) {
    return [fallback];
  }

  const next = agentOptions.filter((agent) => agents.includes(agent));
  return next.length > 0 ? next : [fallback];
}

function applyDesktopSettings(settings: DesktopSettings): DesktopSettings {
  setApiBaseUrl(settings.apiBaseUrl);
  return settings;
}

const agentOptions: DesktopAgent[] = ['CLAUDE', 'CODEX'];

function resolveConnectionTestUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  return `${normalizeApiBaseUrl(raw)}/site/branding`;
}
