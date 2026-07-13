import type { UserSkillItemRes, UserSkillSource } from '@/api/endpoints';

export type DesktopAgent = 'CLAUDE' | 'CODEX';

export interface LocalInstallEntry {
  userSkillId: number;
  source: UserSkillSource;
  skillId?: number;
  slug: string;
  name: string;
  version: string;
  agent?: DesktopAgent;
  installPath: string;
  installedAt?: string;
  updatedAt: string;
  enabledClaude: boolean;
  enabledCodex: boolean;
  installSource?: 'electron' | 'fallback';
}

export type DesktopSkillStatus =
  | 'NOT_INSTALLED'
  | 'INSTALLED_DISABLED'
  | 'INSTALLED_LATEST'
  | 'INSTALLED_UPDATE'
  | 'LOCAL_ONLY';

export interface DesktopSkillView {
  cloud: UserSkillItemRes | null;
  local: LocalInstallEntry | null;
  status: DesktopSkillStatus;
  statusLabel: string;
  description: string;
  actions: Array<'view' | 'install' | 'update' | 'delete' | 'uninstall'>;
}
