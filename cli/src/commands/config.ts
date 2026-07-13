import { Command } from 'commander';
import { loadConfig, saveConfig, unsetConfigKey, configPath, maskToken, DEFAULTS } from '../core/config';
import type { Config } from '../core/config';
import { createApi } from '../core/api';
import axios from 'axios';
import { ok, fail, info, warn } from '../render/log';
import { userError, CliError } from '../core/errors';

const VALID_KEYS = ['apiBaseUrl', 'token', 'defaultTeamId', 'defaultAgent', 'defaultScope'] as const;

function castValue(key: string, raw: string): unknown {
  if (key === 'defaultTeamId') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw userError('defaultTeamId must be a positive integer');
    return n;
  }
  return raw;
}

export function registerConfig(root: Command): void {
  const cfg = root.command('config').description('Read or write smskill config');

  cfg.command('set <key> <value>')
    .description(`set one of: ${VALID_KEYS.join(', ')}`)
    .action((key: string, value: string) => {
      if (!(VALID_KEYS as readonly string[]).includes(key)) {
        throw userError(`unknown config key: ${key}`);
      }
      saveConfig({ [key]: castValue(key, value) } as Partial<Config>);
      ok(`config.${key} updated`);
    });

  cfg.command('get [key]')
    .option('--show', 'reveal token in plain text', false)
    .description('print one key or all config')
    .action((key: string | undefined, options: { show: boolean }) => {
      const c = loadConfig();
      if (key) {
        if (!(VALID_KEYS as readonly string[]).includes(key)) throw userError(`unknown key: ${key}`);
        const v = (c as unknown as Record<string, unknown>)[key];
        if (key === 'token' && !options.show) info(maskToken(c.token));
        else info(v === undefined ? '(not set)' : String(v));
        return;
      }
      const masked = options.show ? c : { ...c, token: maskToken(c.token) };
      info(JSON.stringify(masked, null, 2));
    });

  cfg.command('unset <key>')
    .description('remove a config key')
    .action((key: string) => {
      if (!(VALID_KEYS as readonly string[]).includes(key)) throw userError(`unknown key: ${key}`);
      unsetConfigKey(key as keyof Config);
      ok(`config.${key} cleared`);
    });

  cfg.command('path')
    .description('print config file path')
    .action(() => info(configPath()));

  cfg.command('check')
    .description('verify apiBaseUrl + token by hitting /api/skills and a skill detail')
    .action(async () => {
      const c = loadConfig();
      if (c.apiBaseUrl.startsWith('http://')) warn('apiBaseUrl uses http://; private deploys only');
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      try {
        const page = await api.get<{ items?: Array<{ slug: string }> }>(`/api/skills?size=1&page=1`);
        ok(`apiBaseUrl OK (${c.apiBaseUrl})`);
        if (!c.token) { warn('no token configured; only public endpoints will work'); return; }
        const sample = page?.items?.[0]?.slug;
        if (!sample) { warn('no skills available to probe token; please ask an admin to publish one'); return; }
        await api.get(`/api/skills/${sample}`);
        ok('token OK');
      } catch (e) {
        if (e instanceof CliError) { fail(e.message); throw e; }
        fail(String(e));
        throw e;
      }
    });
}
