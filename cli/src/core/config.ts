import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { Agent, Scope } from './target';

export interface Config {
  apiBaseUrl: string;
  token?: string;
  defaultTeamId?: number;
  defaultAgent: Agent;
  defaultScope: Scope;
}

const FileSchema = z.object({
  apiBaseUrl: z.string().url().optional(),
  token: z.string().min(1).optional(),
  defaultTeamId: z.number().int().positive().optional(),
  defaultAgent: z.enum(['claude', 'codex', 'openclaw', 'generic']).optional(),
  defaultScope: z.enum(['user', 'project']).optional(),
}).partial();

export const DEFAULTS: Config = {
  apiBaseUrl: 'http://localhost:8080',
  defaultAgent: 'claude',
  defaultScope: 'user',
};

export function smskillHome(): string {
  return process.env.SMSKILL_HOME || path.join(os.homedir(), '.smskill');
}

export function configPath(): string {
  return path.join(smskillHome(), 'config.json');
}

function readFile(): Partial<Config> {
  const p = configPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return FileSchema.parse(raw) as Partial<Config>;
  } catch (e) {
    throw new Error(`config file at ${p} is invalid: ${(e as Error).message}`);
  }
}

function readEnv(): Partial<Config> {
  const out: Partial<Config> = {};
  if (process.env.SMSKILL_API) out.apiBaseUrl = process.env.SMSKILL_API;
  if (process.env.SMSKILL_API_BASE_URL) out.apiBaseUrl = process.env.SMSKILL_API_BASE_URL;
  if (process.env.SMSKILL_TOKEN) out.token = process.env.SMSKILL_TOKEN;
  if (process.env.SMSKILL_TEAM_ID) {
    const n = Number(process.env.SMSKILL_TEAM_ID);
    if (Number.isInteger(n) && n > 0) out.defaultTeamId = n;
  }
  if (process.env.SMSKILL_AGENT) out.defaultAgent = process.env.SMSKILL_AGENT as Agent;
  if (process.env.SMSKILL_SCOPE) out.defaultScope = process.env.SMSKILL_SCOPE as Scope;
  return out;
}

export function loadConfig(): Config {
  const file = readFile();
  const env = readEnv();
  return { ...DEFAULTS, ...file, ...env };
}

export function saveConfig(partial: Partial<Config>): void {
  const dir = smskillHome();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else {
    fs.chmodSync(dir, 0o700);
  }
  const existing = readFile();
  const next = { ...existing, ...partial };
  // strip undefined keys so unset works via { token: undefined } if we ever need it
  for (const k of Object.keys(next) as (keyof Config)[]) {
    if (next[k] === undefined) delete next[k];
  }
  const p = configPath();
  fs.writeFileSync(p, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(p, 0o600);
}

export function unsetConfigKey(key: keyof Config): void {
  const existing = readFile();
  delete (existing as Record<string, unknown>)[key];
  const p = configPath();
  if (Object.keys(existing).length === 0) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return;
  }
  fs.writeFileSync(p, JSON.stringify(existing, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(p, 0o600);
}

export function maskToken(token: string | undefined): string {
  if (!token) return '(not set)';
  if (token.length < 12) return '••••';
  return token.slice(0, 12) + '••••';
}
