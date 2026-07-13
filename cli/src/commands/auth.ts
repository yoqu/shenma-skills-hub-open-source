import axios from 'axios';
import { Command } from 'commander';
import { loadConfig, saveConfig, unsetConfigKey, maskToken } from '../core/config';
import { createApi } from '../core/api';
import { ok, fail, info, warn } from '../render/log';
import { askHidden, select } from '../render/prompt';
import { openInBrowser } from '../core/browser';
import { userError, CliError } from '../core/errors';
import type {
  CliDeviceInitRes,
  CliDevicePollRes,
  CliWebInfoRes,
  LoginUser,
} from '../types/api';

interface LoginOptions {
  api?: string;
  web?: boolean;
  paste?: boolean;
  token?: string;
  noOpen?: boolean;
}

type Mode = 'web' | 'token';

function describeUser(user: LoginUser | undefined): string {
  if (!user) return '(unknown user)';
  const label = user.handle || user.name || user.email || user.phone || `id=${user.id}`;
  const teams = user.myTeams ?? [];
  if (teams.length === 0) return `${label} (no team)`;
  const primary = teams[0];
  const teamLabel = primary.slug || primary.name || `team#${primary.id}`;
  const role = primary.role ? `/${primary.role}` : '';
  const more = teams.length > 1 ? ` +${teams.length - 1} more` : '';
  return `${label} @ ${teamLabel}${role}${more}`;
}

function pickModeFromFlags(opts: LoginOptions): Mode | null {
  if (opts.web) return 'web';
  if (opts.paste || opts.token) return 'token';
  return null;
}

async function chooseMode(): Promise<Mode> {
  try {
    return await select<Mode>('选择登录方式', [
      { label: 'Web 授权',   value: 'web',   hint: '浏览器打开 SkillStack 站点确认' },
      { label: '粘贴 token', value: 'token', hint: '从 web 的 /profile/cli-token 复制' },
    ]);
  } catch (e) {
    throw userError((e as Error).message === 'cancelled' ? 'login cancelled' : (e as Error).message);
  }
}

function persistLogin(opts: {
  baseUrl: string;
  apiBaseUrlOverride: boolean;
  token: string;
  user: LoginUser | undefined;
  existingTeamId: number | undefined;
}): void {
  const update: Record<string, unknown> = { token: opts.token };
  if (opts.apiBaseUrlOverride) update.apiBaseUrl = opts.baseUrl;
  if (!opts.existingTeamId && opts.user?.myTeams?.[0]?.id) {
    update.defaultTeamId = opts.user.myTeams[0].id;
  }
  saveConfig(update);

  ok(`Logged in as ${describeUser(opts.user)}`);
  info(`  apiBaseUrl: ${opts.baseUrl}`);
  info(`  token: ${maskToken(opts.token)}`);
  if (update.defaultTeamId) info(`  defaultTeamId: ${update.defaultTeamId} (saved)`);
  else if (!opts.existingTeamId) warn('no defaultTeamId set; pass --team <id> for team-scoped commands');
}

async function loginToken(baseUrl: string, opts: LoginOptions): Promise<{ token: string; user?: LoginUser }> {
  let tokenPage: string | null = null;
  try {
    const webInfo = await createApi({ baseUrl, axios }).get<CliWebInfoRes>('/api/auth/cli/web-info');
    tokenPage = `${webInfo.webBaseUrl.replace(/\/$/, '')}${webInfo.tokenPagePath}`;
  } catch {
    // older backend without /web-info — skip auto-open.
  }
  if (tokenPage) {
    info('Open this page in the browser to copy your token:');
    info(`  ${tokenPage}`);
    if (!opts.noOpen) await openInBrowser(tokenPage);
  } else {
    info('Get your token from the SkillStack web UI: 设置 → CLI Token');
  }
  const token = (opts.token ?? (await askHidden('Paste token here'))).trim();
  if (!token) throw userError('token is required');

  const api = createApi({ baseUrl, token, axios });
  const user = await api.get<LoginUser>('/api/me');
  return { token, user };
}

async function loginWeb(baseUrl: string, opts: LoginOptions): Promise<{ token: string; user?: LoginUser }> {
  const api = createApi({ baseUrl, axios });
  const init = await api.post<CliDeviceInitRes>('/api/auth/cli/device-init');
  info('已发起 web 授权请求：');
  info(`  授权码：${init.userCode}`);
  info(`  请在浏览器打开：${init.verificationUri}`);
  if (!opts.noOpen) await openInBrowser(init.verificationUri);
  info(`  等待 web 端确认（${Math.round(init.expiresIn / 60)} 分钟内有效）...`);

  const intervalMs = Math.max(1, init.interval) * 1000;
  const deadline = Date.now() + init.expiresIn * 1000;
  let dots = 0;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const poll = await api.post<CliDevicePollRes>('/api/auth/cli/device-poll', { deviceCode: init.deviceCode });
    if (poll.status === 'approved') {
      process.stdout.write('\n');
      if (!poll.token) throw new CliError(2, 'server approved but returned no token');
      return { token: poll.token, user: poll.user };
    }
    dots = (dots + 1) % 4;
    process.stdout.write(`\r  waiting${'.'.repeat(dots)}${' '.repeat(3 - dots)}`);
  }
  process.stdout.write('\n');
  throw userError('web authorization timed out; run `smskill login --web` again');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function registerAuth(root: Command): void {
  root.command('login')
    .description('Sign in via web authorization or token paste and save the JWT')
    .option('--api <url>', 'override apiBaseUrl for this login (also saved on success)')
    .option('--web', 'use web device authorization flow (opens browser, polls for token)')
    .option('--paste', 'paste a token copied from the web CLI Token page')
    .option('--token <jwt>', 'use a token directly (skips both prompt and browser)')
    .option('--no-open', 'do not auto-open the browser; just print URLs')
    .action(async (opts: LoginOptions) => {
      const c = loadConfig();
      const baseUrl = opts.api?.trim() || c.apiBaseUrl;
      if (baseUrl.startsWith('http://')) warn('apiBaseUrl uses http://; private deploys only');

      const mode: Mode = pickModeFromFlags(opts) ?? (await chooseMode());

      let result: { token: string; user?: LoginUser };
      try {
        result = mode === 'web' ? await loginWeb(baseUrl, opts) : await loginToken(baseUrl, opts);
      } catch (e) {
        if (e instanceof CliError) { fail(e.message); throw e; }
        throw e;
      }

      persistLogin({
        baseUrl,
        apiBaseUrlOverride: Boolean(opts.api),
        token: result.token,
        user: result.user,
        existingTeamId: c.defaultTeamId,
      });
    });

  root.command('logout')
    .description('Clear the saved token from local config')
    .action(() => {
      const c = loadConfig();
      if (!c.token) { warn('no token configured; nothing to clear'); return; }
      unsetConfigKey('token');
      ok('token cleared');
    });

  root.command('whoami')
    .description('Show the currently logged-in user')
    .action(async () => {
      const c = loadConfig();
      if (!c.token) throw userError('not logged in; run `smskill login`');
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      try {
        const me = await api.get<LoginUser>('/api/me');
        ok(describeUser(me));
        info(`  apiBaseUrl: ${c.apiBaseUrl}`);
        info(`  token: ${maskToken(c.token)}`);
      } catch (e) {
        if (e instanceof CliError) { fail(e.message); throw e; }
        throw e;
      }
    });
}
