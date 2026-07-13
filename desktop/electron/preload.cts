import { contextBridge, ipcRenderer } from 'electron';

type Agent = 'CLAUDE' | 'CODEX';

type DesktopConfig = {
  agent: Agent;
  agents: Agent[];
  skillStorageLocation: 'skillstack';
  skillSyncMethod: 'symlink' | 'copy';
  apiBaseUrl: string;
  skillHomeDir: string;
  claudeSkillsDir: string;
  codexSkillsDir: string;
};

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

type LocalInstallEntry = {
  userSkillId: number;
  source: 'PERSONAL' | 'TEAM' | 'PUBLIC';
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  agent?: Agent;
  installPath: string;
  installedAt?: string;
  updatedAt: string;
  enabledClaude: boolean;
  enabledCodex: boolean;
  installSource?: 'electron' | 'fallback';
};

type InstallSkillInput = {
  userSkillId: number;
  source: 'PERSONAL' | 'TEAM' | 'PUBLIC';
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  zipUrl: string;
  authToken?: string;
  headers?: Record<string, string>;
};

type WindowMode = 'login' | 'app';

type ApiRequestInput = {
  apiBaseUrl?: string;
  method?: string;
  url: string;
  params?: unknown;
  headers?: Record<string, string>;
  body?: unknown;
  requestId?: string;
};

type ApiResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
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

type LogEventInput = {
  level?: 'debug' | 'info' | 'warn' | 'error';
  moduleName?: string;
  message: string;
  fields?: Record<string, unknown>;
};

type LogExportResult = {
  filePath: string;
  files: string[];
};

contextBridge.exposeInMainWorld('skillstackDesktop', {
  platform: process.platform,
  getConfig: (): Promise<DesktopResult<DesktopConfig>> => ipcRenderer.invoke('skillstack:config:get'),
  saveConfig: (config: Partial<DesktopConfig>): Promise<DesktopResult<DesktopConfig>> => ipcRenderer.invoke('skillstack:config:save', config),
  listLocalInstalls: (): Promise<DesktopResult<LocalInstallEntry[]>> => ipcRenderer.invoke('skillstack:local-installs:list'),
  upsertLocalInstall: (entry: LocalInstallEntry): Promise<DesktopResult<LocalInstallEntry>> => ipcRenderer.invoke('skillstack:local-installs:upsert', entry),
  removeLocalInstall: (input: { userSkillId?: number; slug?: string }): Promise<DesktopResult<{ removed: boolean }>> =>
    ipcRenderer.invoke('skillstack:local-installs:remove', input),
  setLocalSkillEnabled: (input: { userSkillId?: number; slug?: string; enabled: boolean }): Promise<DesktopResult<LocalInstallEntry>> =>
    ipcRenderer.invoke('skillstack:local-installs:set-enabled', input),
  scanSkills: (): Promise<DesktopResult<DesktopSkill[]>> => ipcRenderer.invoke('skillstack:skills:scan'),
  installSkill: (input: InstallSkillInput): Promise<DesktopResult<DesktopSkill>> => ipcRenderer.invoke('skillstack:skills:install', input),
  uninstallSkill: (slug: string): Promise<DesktopResult<{ slug: string }>> => ipcRenderer.invoke('skillstack:skills:uninstall', slug),
  pickSkillFile: (): Promise<DesktopResult<PickedSkillFile | null>> => ipcRenderer.invoke('skillstack:skill-file:pick'),
  openInstallDir: (): Promise<DesktopResult<{ installDir: string }>> => ipcRenderer.invoke('skillstack:install-dir:open'),
  setWindowMode: (mode: WindowMode): Promise<DesktopResult<{ mode: WindowMode }>> => ipcRenderer.invoke('skillstack:window:mode', mode),
  apiRequest: (input: ApiRequestInput): Promise<DesktopResult<ApiResponse>> => ipcRenderer.invoke('skillstack:api:request', input),
  logEvent: (input: LogEventInput): Promise<DesktopResult<{ logged: boolean }>> => ipcRenderer.invoke('skillstack:log:event', input),
  exportLogs: (): Promise<DesktopResult<LogExportResult>> => ipcRenderer.invoke('skillstack:logs:export'),
});
