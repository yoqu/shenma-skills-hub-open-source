import axios from 'axios';
import { Command } from 'commander';
import { loadConfig, saveConfig } from '../core/config';
import { createApi } from '../core/api';
import { fetchMyTeams, matchTeam, resolveTeam } from '../core/teams';
import { renderTable } from '../render/table';
import { ok, info, warn } from '../render/log';
import { userError } from '../core/errors';

function requireToken(): ReturnType<typeof loadConfig> {
  const c = loadConfig();
  if (!c.token) throw userError('token required: run `smskill auth login` or set config.token');
  return c;
}

async function listTeams(): Promise<void> {
  const c = requireToken();
  const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
  const teams = await fetchMyTeams(api);
  if (!teams.length) { warn('you are not a member of any team'); return; }
  const rows = teams.map(t => [
    t.id === c.defaultTeamId ? `* ${t.id}` : `  ${t.id}`,
    t.slug ?? '',
    t.name ?? '',
    t.role ?? '',
    t.members ?? '',
  ]);
  info(renderTable(['id', 'slug', 'name', 'role', 'members'], rows));
  info('(* = current default team)');
  if (c.defaultTeamId == null) warn('no default team set; use `smskill team use <id|slug>`');
}

export function registerTeam(root: Command): void {
  const team = root.command('team').description('List your teams and switch the default team');

  team.command('list')
    .description('list teams you belong to (marks the current default)')
    .action(listTeams);

  team.command('use <idOrSlug>')
    .description('set the default team for future uploads (accepts team id or slug)')
    .action(async (ref: string) => {
      const c = requireToken();
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const t = await resolveTeam(api, ref);
      saveConfig({ defaultTeamId: t.id });
      ok(`default team → ${t.name} (id ${t.id}, ${t.slug})`);
    });

  team.command('current')
    .description('show the current default team')
    .action(async () => {
      const c = loadConfig();
      if (c.defaultTeamId == null) { warn('no default team set; use `smskill team use <id|slug>`'); return; }
      if (!c.token) { info(`defaultTeamId: ${c.defaultTeamId}`); return; }
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const t = matchTeam(await fetchMyTeams(api), String(c.defaultTeamId));
      if (t) info(`default team: ${t.name} (id ${t.id}, ${t.slug})`);
      else { info(`defaultTeamId: ${c.defaultTeamId}`); warn('this id is not among your current teams'); }
    });

  // top-level convenience alias: `smskill teams`
  root.command('teams')
    .description('alias of `team list`')
    .action(listTeams);
}
