import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, saveConfig, configPath, maskToken, DEFAULTS } from '../../src/core/config';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-cfg-'));
  process.env.SMSKILL_HOME = tmpHome;
  for (const k of ['SMSKILL_API', 'SMSKILL_API_BASE_URL', 'SMSKILL_TOKEN', 'SMSKILL_TEAM_ID', 'SMSKILL_AGENT', 'SMSKILL_SCOPE']) {
    delete process.env[k];
  }
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  delete process.env.SMSKILL_HOME;
});

describe('loadConfig', () => {
  it('returns defaults when no file and no env', () => {
    const c = loadConfig();
    expect(c.apiBaseUrl).toBe(DEFAULTS.apiBaseUrl);
    expect(c.defaultAgent).toBe('claude');
    expect(c.defaultScope).toBe('user');
    expect(c.token).toBeUndefined();
  });

  it('reads file values', () => {
    saveConfig({ apiBaseUrl: 'https://x', token: 'lst_aaa', defaultTeamId: 5 });
    const c = loadConfig();
    expect(c.apiBaseUrl).toBe('https://x');
    expect(c.token).toBe('lst_aaa');
    expect(c.defaultTeamId).toBe(5);
  });

  it('env overrides file', () => {
    saveConfig({ apiBaseUrl: 'https://file' });
    process.env.SMSKILL_API_BASE_URL = 'https://env';
    process.env.SMSKILL_AGENT = 'codex';
    const c = loadConfig();
    expect(c.apiBaseUrl).toBe('https://env');
    expect(c.defaultAgent).toBe('codex');
  });

  it('supports SMSKILL_API as a fallback alias', () => {
    saveConfig({ apiBaseUrl: 'https://file' });
    process.env.SMSKILL_API = 'https://alias';
    let c = loadConfig();
    expect(c.apiBaseUrl).toBe('https://alias');

    process.env.SMSKILL_API_BASE_URL = 'https://env';
    c = loadConfig();
    expect(c.apiBaseUrl).toBe('https://env');
  });

  it('saves config with 0600 perms', () => {
    saveConfig({ token: 'lst_secret' });
    const stat = fs.statSync(configPath());
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe('maskToken', () => {
  it('masks long tokens', () => {
    expect(maskToken('lst_abc12345xyz789')).toBe('lst_abc12345••••');
  });
  it('returns empty mask for short input', () => {
    expect(maskToken('short')).toBe('••••');
  });
  it('handles undefined', () => {
    expect(maskToken(undefined)).toBe('(not set)');
  });
});
