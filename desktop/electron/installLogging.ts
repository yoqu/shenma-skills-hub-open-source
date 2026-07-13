import { randomUUID } from 'node:crypto';
import { sanitizeUrlForLog, serializeErrorForLog, type DesktopLogger, type LogFields, type LogLevel } from './logger';

export type InstallLogContextInput = {
  installId?: string;
  slug: string;
  version: string;
  source: string;
  userSkillId: number;
  skillId?: number;
  zipUrl?: string;
  startedAt?: number;
};

export type InstallLogContext = {
  installId: string;
  slug: string;
  version: string;
  source: string;
  userSkillId: number;
  skillId?: number;
  zipUrl?: string;
  startedAt: number;
};

export function createInstallId(): string {
  return `install_${randomUUID()}`;
}

export function createInstallLogContext(input: InstallLogContextInput): InstallLogContext {
  return {
    installId: input.installId || createInstallId(),
    slug: input.slug,
    version: input.version,
    source: input.source,
    userSkillId: input.userSkillId,
    skillId: input.skillId,
    zipUrl: input.zipUrl ? sanitizeUrlForLog(input.zipUrl) : undefined,
    startedAt: input.startedAt ?? Date.now(),
  };
}

export function logInstallStep(
  logger: DesktopLogger,
  context: InstallLogContext,
  message: string,
  fields: LogFields = {},
  level: LogLevel = 'info',
): void {
  logger[level]('skillstack_desktop::install', message, {
    installId: context.installId,
    slug: context.slug,
    version: context.version,
    source: context.source,
    userSkillId: context.userSkillId,
    skillId: context.skillId,
    zipUrl: context.zipUrl,
    durationMs: Date.now() - context.startedAt,
    ...normalizeInstallFields(fields),
  });
}

function normalizeInstallFields(fields: LogFields): LogFields {
  const result: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'zipUrl' && typeof value === 'string') {
      result[key] = sanitizeUrlForLog(value);
    } else if (key === 'error' || key === 'cause') {
      result[key] = serializeErrorForLog(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
