import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitizeForLog, sanitizeUrlForLog } from './logger';

export type DesktopLogExportInput = {
  logsDir: string;
  outputDir: string;
  settingsSummary: Record<string, unknown>;
  environmentSummary: Record<string, unknown>;
  now?: () => Date;
};

export type DesktopLogExportResult = {
  filePath: string;
  files: string[];
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

export async function exportDesktopLogs(input: DesktopLogExportInput): Promise<DesktopLogExportResult> {
  await fs.mkdir(input.outputDir, { recursive: true });
  const entries = await collectLogExportEntries(input);
  const fileName = `skillstack-desktop-logs-${formatExportTimestamp((input.now ?? (() => new Date()))())}.zip`;
  const filePath = path.join(input.outputDir, fileName);

  await fs.writeFile(filePath, createZipArchive(entries));

  return {
    filePath,
    files: entries.map((entry) => entry.name),
  };
}

async function collectLogExportEntries(input: DesktopLogExportInput): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  for (const fileName of await listDesktopLogFiles(input.logsDir)) {
    entries.push({
      name: fileName,
      data: await fs.readFile(path.join(input.logsDir, fileName)),
    });
  }

  entries.push({
    name: 'environment-summary.json',
    data: Buffer.from(`${JSON.stringify(sanitizeSummary(input.environmentSummary), null, 2)}\n`, 'utf8'),
  });
  entries.push({
    name: 'settings-summary.json',
    data: Buffer.from(`${JSON.stringify(sanitizeSummary(input.settingsSummary), null, 2)}\n`, 'utf8'),
  });

  return entries;
}

async function listDesktopLogFiles(logsDir: string): Promise<string[]> {
  const names = await fs.readdir(logsDir).catch(() => []);
  return names
    .filter((name) => name === 'skillstack-desktop.log' || /^skillstack-desktop\.log\.\d+$/.test(name))
    .sort((left, right) => {
      if (left === 'skillstack-desktop.log') {
        return -1;
      }
      if (right === 'skillstack-desktop.log') {
        return 1;
      }
      return left.localeCompare(right);
    });
}

function sanitizeSummary(value: Record<string, unknown>): unknown {
  const next = { ...value };
  if (typeof next.apiBaseUrl === 'string') {
    next.apiBaseUrl = sanitizeUrlForLog(next.apiBaseUrl);
  }
  return sanitizeForLog(next);
}

function createZipArchive(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function formatExportTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    '-',
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join('');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
