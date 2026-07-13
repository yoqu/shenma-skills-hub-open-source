import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as logExport from '../../electron/logExport';

let tmpDir: string;

describe('desktop log export', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp('/tmp/skillstack-log-export-');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('exports log files and safe summaries without sqlite or skill contents', async () => {
    const logsDir = path.join(tmpDir, 'logs');
    const skillsDir = path.join(tmpDir, 'skills');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(logsDir, 'skillstack-desktop.log'), 'current log', 'utf8');
    await fs.writeFile(path.join(logsDir, 'skillstack-desktop.log.1'), 'old log', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'skillstack.db'), 'raw sqlite content', 'utf8');
    await fs.writeFile(path.join(skillsDir, 'SKILL.md'), 'skill private content', 'utf8');

    const result = await (logExport as any).exportDesktopLogs({
      logsDir,
      outputDir: tmpDir,
      settingsSummary: {
        agents: ['CLAUDE'],
        skillSyncMethod: 'symlink',
        apiBaseUrl: 'https://example.com/api?token=secret',
        skillHomeDir: skillsDir,
      },
      environmentSummary: {
        appSessionId: 'app_1',
        platform: 'darwin',
      },
      now: () => new Date(2026, 5, 4, 14, 0, 0),
    });

    const zipText = await fs.readFile(result.filePath, 'latin1');
    expect(path.basename(result.filePath)).toBe('skillstack-desktop-logs-20260604-140000.zip');
    expect(result.files).toEqual([
      'skillstack-desktop.log',
      'skillstack-desktop.log.1',
      'environment-summary.json',
      'settings-summary.json',
    ]);
    expect(zipText).toContain('current log');
    expect(zipText).toContain('old log');
    expect(zipText).toContain('environment-summary.json');
    expect(zipText).toContain('settings-summary.json');
    expect(zipText).not.toContain('raw sqlite content');
    expect(zipText).not.toContain('skill private content');
    expect(zipText).not.toContain('secret');
  });
});
