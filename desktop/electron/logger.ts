import path from 'node:path';
import os from 'node:os';
import electronLog from 'electron-log/node';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DesktopLogger = {
  debug(moduleName: string, message: string, fields?: LogFields): void;
  info(moduleName: string, message: string, fields?: LogFields): void;
  warn(moduleName: string, message: string, fields?: LogFields): void;
  error(moduleName: string, message: string, fields?: LogFields): void;
};

export type LogFields = Record<string, unknown>;

export type LogWriter = {
  write(line: string): void;
};

export type MemoryLogWriter = LogWriter & {
  lines: string[];
};

export type DesktopLoggerOptions = {
  writer?: LogWriter;
  now?: () => Date;
};

export type BodySummary = {
  text: string;
  originalLength: number;
  truncated: boolean;
};

export type BodySummaryOptions = {
  maxLength?: number;
};

export type StartupEnvironmentSnapshotInput = {
  appSessionId: string;
  appVersion: string;
  isDev: boolean;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
  logFilePath: string;
  settingsPath: string;
  databasePath: string;
  settings: {
    agents: string[];
    skillSyncMethod: string;
    apiBaseUrl: string;
    skillHomeDir: string;
    claudeSkillsDir: string;
    codexSkillsDir: string;
  };
};

export type StartupEnvironmentSnapshot = {
  appSessionId: string;
  appVersion: string;
  isDev: boolean;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
  logFilePath: string;
  settingsPath: string;
  databasePath: string;
  skillHomeDir: string;
  claudeSkillsDir: string;
  codexSkillsDir: string;
  syncMethod: string;
  agents: string[];
  apiBaseUrl: string;
};

type SerializedFormDataBody = {
  kind: 'formData';
  entries: SerializedFormDataEntry[];
};

type SerializedFormDataEntry = {
  name: string;
  value: string;
} | {
  name: string;
  fileName: string;
  mimeType: string;
  data?: ArrayBuffer;
};

const defaultMaxBodyLength = 16 * 1024;
const logFilePath = path.join(os.homedir(), '.skillstack', 'logs', 'skillstack-desktop.log');
const sensitiveKeyPattern = /(password|passwd|pwd|token|secret|authorization|cookie|credential|verificationcode|captcha|otp|smscode|devicecode|usercode)/i;
const sensitiveQueryKeyPattern = /(password|passwd|pwd|token|secret|authorization|cookie|credential|verification[_-]?code|captcha|otp|sms[_-]?code|device[_-]?code|user[_-]?code|signature|sign)/i;

let singletonLogger: DesktopLogger | undefined;

export function createMemoryLogWriter(): MemoryLogWriter {
  const lines: string[] = [];

  return {
    lines,
    write(line: string) {
      lines.push(line);
    },
  };
}

export function createDesktopLogger(options: DesktopLoggerOptions = {}): DesktopLogger {
  const writer = options.writer ?? createElectronLogWriter();
  const now = options.now ?? (() => new Date());

  return {
    debug(moduleName, message, fields) {
      writeLogLine(writer, now(), 'debug', moduleName, message, fields);
    },
    info(moduleName, message, fields) {
      writeLogLine(writer, now(), 'info', moduleName, message, fields);
    },
    warn(moduleName, message, fields) {
      writeLogLine(writer, now(), 'warn', moduleName, message, fields);
    },
    error(moduleName, message, fields) {
      writeLogLine(writer, now(), 'error', moduleName, message, fields);
    },
  };
}

export function getDesktopLogger(): DesktopLogger {
  if (!singletonLogger) {
    singletonLogger = createDesktopLogger();
  }

  return singletonLogger;
}

export function getDesktopLogFilePath(): string {
  return logFilePath;
}

export function buildStartupEnvironmentSnapshot(input: StartupEnvironmentSnapshotInput): StartupEnvironmentSnapshot {
  return {
    appSessionId: input.appSessionId,
    appVersion: input.appVersion,
    isDev: input.isDev,
    platform: input.platform,
    arch: input.arch,
    electronVersion: input.electronVersion,
    nodeVersion: input.nodeVersion,
    logFilePath: input.logFilePath,
    settingsPath: input.settingsPath,
    databasePath: input.databasePath,
    skillHomeDir: input.settings.skillHomeDir,
    claudeSkillsDir: input.settings.claudeSkillsDir,
    codexSkillsDir: input.settings.codexSkillsDir,
    syncMethod: input.settings.skillSyncMethod,
    agents: input.settings.agents,
    apiBaseUrl: sanitizeUrlForLog(input.settings.apiBaseUrl),
  };
}

export function sanitizeForLog(value: unknown): unknown {
  return sanitizeValue(value, new WeakSet<object>());
}

export function sanitizeUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (sensitiveQueryKeyPattern.test(key)) {
        url.searchParams.set(key, '<redacted>');
      } else {
        url.searchParams.set(key, truncateQueryValue(url.searchParams.get(key) || ''));
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function summarizeBodyForLog(value: unknown, options: BodySummaryOptions = {}): BodySummary {
  const maxLength = Math.max(0, options.maxLength ?? defaultMaxBodyLength);
  const normalized = normalizeBodyForLog(value);
  const sanitized = sanitizeForLog(normalized);
  const text = stringifyForLog(sanitized);
  const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text;

  return {
    text: truncatedText,
    originalLength: text.length,
    truncated: text.length > maxLength,
  };
}

export function serializeErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return sanitizeForLog({
      name: error.name,
      message: error.message,
      stack: error.stack,
    }) as Record<string, unknown>;
  }

  return sanitizeForLog({ message: String(error) }) as Record<string, unknown>;
}

function createElectronLogWriter(): LogWriter {
  electronLog.transports.file.resolvePathFn = () => logFilePath;
  electronLog.transports.file.format = '{text}';
  electronLog.transports.file.level = 'debug';
  electronLog.transports.file.maxSize = 5 * 1024 * 1024;
  electronLog.transports.console.level = false;

  return {
    write(line: string) {
      electronLog.info(line);
    },
  };
}

function writeLogLine(
  writer: LogWriter,
  date: Date,
  level: LogLevel,
  moduleName: string,
  message: string,
  fields?: LogFields,
): void {
  const fieldText = formatFields(fields);
  const line = [
    `[${formatDate(date)}][${formatTime(date)}][${level.toUpperCase()}][${moduleName}]`,
    message,
    fieldText,
  ].filter(Boolean).join(' ');

  writer.write(line);
}

function formatFields(fields?: LogFields): string {
  if (!fields) {
    return '';
  }

  const sanitized = sanitizeForLog(fields);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return '';
  }

  return Object.entries(sanitized as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatFieldValue(value)}`)
    .join(' ');
}

function formatFieldValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  return stringifyForLog(value);
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  if (value instanceof Error) {
    return serializeErrorForLog(value);
  }

  if (value instanceof ArrayBuffer) {
    return { type: 'ArrayBuffer', byteLength: value.byteLength };
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { type: 'Blob', size: value.size, mimeType: value.type };
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '<circular>';
  }
  seen.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    result[key] = sensitiveKeyPattern.test(key) ? '<redacted>' : sanitizeValue(fieldValue, seen);
  }

  return result;
}

function normalizeBodyForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }

  if (isSerializedFormDataBody(value)) {
    const fields: Record<string, unknown> = {};
    for (const entry of value.entries) {
      if ('fileName' in entry) {
        fields[entry.name] = {
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          size: entry.data?.byteLength ?? 0,
        };
      } else {
        fields[entry.name] = entry.value;
      }
    }

    return {
      kind: value.kind,
      fields,
    };
  }

  return value;
}

function stringifyForLog(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isSerializedFormDataBody(value: unknown): value is SerializedFormDataBody {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as SerializedFormDataBody).kind === 'formData'
    && Array.isArray((value as SerializedFormDataBody).entries),
  );
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-');
}

function formatTime(date: Date): string {
  return [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join(':');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function truncateQueryValue(value: string): string {
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
}
