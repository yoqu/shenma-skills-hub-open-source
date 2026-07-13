import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as loggerModule from '../../electron/logger';

describe('startup environment snapshot', () => {
  it('contains the desktop diagnostic environment fields', () => {
    const buildStartupEnvironmentSnapshot = (loggerModule as any).buildStartupEnvironmentSnapshot;

    expect(buildStartupEnvironmentSnapshot).toBeTypeOf('function');

    const snapshot = buildStartupEnvironmentSnapshot({
      appSessionId: 'app_123',
      appVersion: '0.1.0',
      isDev: true,
      platform: 'darwin',
      arch: 'arm64',
      electronVersion: '33.2.1',
      nodeVersion: '22.0.0',
      logFilePath: '/tmp/skillstack.log',
      settings: {
        agent: 'CLAUDE',
        agents: ['CLAUDE', 'CODEX'],
        skillStorageLocation: 'skillstack',
        skillSyncMethod: 'copy',
        apiBaseUrl: 'https://example.com/api?token=secret',
        skillHomeDir: '/tmp/.skillstack/skills',
        claudeSkillsDir: '/tmp/.claude/skills',
        codexSkillsDir: '/tmp/.codex/skills',
      },
      settingsPath: '/tmp/.skillstack/settings.json',
      databasePath: '/tmp/.skillstack/skillstack.db',
    });

    expect(snapshot).toEqual({
      appSessionId: 'app_123',
      appVersion: '0.1.0',
      isDev: true,
      platform: 'darwin',
      arch: 'arm64',
      electronVersion: '33.2.1',
      nodeVersion: '22.0.0',
      logFilePath: '/tmp/skillstack.log',
      settingsPath: '/tmp/.skillstack/settings.json',
      databasePath: '/tmp/.skillstack/skillstack.db',
      skillHomeDir: '/tmp/.skillstack/skills',
      claudeSkillsDir: '/tmp/.claude/skills',
      codexSkillsDir: '/tmp/.codex/skills',
      syncMethod: 'copy',
      agents: ['CLAUDE', 'CODEX'],
      apiBaseUrl: 'https://example.com/api?token=%3Credacted%3E',
    });
    expect(snapshot.skillHomeDir).toBe(path.normalize('/tmp/.skillstack/skills'));
  });
});
