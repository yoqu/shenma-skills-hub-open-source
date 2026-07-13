type SkillstackDesktopAgent = 'CLAUDE' | 'CODEX';

type SkillstackDesktopConfig = {
  agent: SkillstackDesktopAgent;
  agents: SkillstackDesktopAgent[];
  skillStorageLocation: 'skillstack';
  skillSyncMethod: 'symlink' | 'copy';
  apiBaseUrl: string;
  skillHomeDir: string;
  claudeSkillsDir: string;
  codexSkillsDir: string;
};

type SkillstackDesktopSkill = {
  slug: string;
  name: string;
  version: string;
  installPath: string;
  updatedAt: string;
};

type SkillstackDesktopPickedSkillFile = {
  name: string;
  path: string;
  data: ArrayBuffer;
};

type SkillstackDesktopLocalInstall = {
  userSkillId: number;
  source: 'PERSONAL' | 'TEAM' | 'PUBLIC';
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  agent?: SkillstackDesktopAgent;
  installPath: string;
  installedAt?: string;
  updatedAt: string;
  enabledClaude: boolean;
  enabledCodex: boolean;
  installSource?: 'electron' | 'fallback';
};

type SkillstackDesktopInstallSkillInput = {
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

type SkillstackDesktopWindowMode = 'login' | 'app';

type SkillstackDesktopApiRequestInput = {
  apiBaseUrl?: string;
  method?: string;
  url: string;
  params?: unknown;
  headers?: Record<string, string>;
  body?: unknown;
  requestId?: string;
};

type SkillstackDesktopApiResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
};

type SkillstackDesktopResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type SkillstackDesktopLogEventInput = {
  level?: 'debug' | 'info' | 'warn' | 'error';
  moduleName?: string;
  message: string;
  fields?: Record<string, unknown>;
};

type SkillstackDesktopLogExportResult = {
  filePath: string;
  files: string[];
};

type SkillstackDesktopApi = {
  platform: string;
  getConfig: () => Promise<SkillstackDesktopResult<SkillstackDesktopConfig>>;
  saveConfig: (config: Partial<SkillstackDesktopConfig>) => Promise<SkillstackDesktopResult<SkillstackDesktopConfig>>;
  listLocalInstalls: () => Promise<SkillstackDesktopResult<SkillstackDesktopLocalInstall[]>>;
  upsertLocalInstall: (entry: SkillstackDesktopLocalInstall) => Promise<SkillstackDesktopResult<SkillstackDesktopLocalInstall>>;
  removeLocalInstall: (input: { userSkillId?: number; slug?: string }) => Promise<SkillstackDesktopResult<{ removed: boolean }>>;
  setLocalSkillEnabled: (input: { userSkillId?: number; slug?: string; enabled: boolean }) => Promise<SkillstackDesktopResult<SkillstackDesktopLocalInstall>>;
  scanSkills: () => Promise<SkillstackDesktopResult<SkillstackDesktopSkill[]>>;
  installSkill: (input: SkillstackDesktopInstallSkillInput) => Promise<SkillstackDesktopResult<SkillstackDesktopSkill>>;
  uninstallSkill: (slug: string) => Promise<SkillstackDesktopResult<{ slug: string }>>;
  pickSkillFile: () => Promise<SkillstackDesktopResult<SkillstackDesktopPickedSkillFile | null>>;
  openInstallDir: () => Promise<SkillstackDesktopResult<{ installDir: string }>>;
  setWindowMode: (mode: SkillstackDesktopWindowMode) => Promise<SkillstackDesktopResult<{ mode: SkillstackDesktopWindowMode }>>;
  apiRequest: (input: SkillstackDesktopApiRequestInput) => Promise<SkillstackDesktopResult<SkillstackDesktopApiResponse>>;
  logEvent: (input: SkillstackDesktopLogEventInput) => Promise<SkillstackDesktopResult<{ logged: boolean }>>;
  exportLogs: () => Promise<SkillstackDesktopResult<SkillstackDesktopLogExportResult>>;
};

declare global {
  interface Window {
    skillstackDesktop: SkillstackDesktopApi;
  }
}

export {};
