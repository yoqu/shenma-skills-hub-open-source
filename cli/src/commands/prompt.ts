import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig, smskillHome } from '../core/config';
import { createApi } from '../core/api';
import { parsePromptRef } from '../core/promptRef';
import { upsertEntry } from '../core/lockfile';
import { renderTable } from '../render/table';
import { info, ok } from '../render/log';
import { userError } from '../core/errors';
import type { PageResult, PromptCard, PromptDetail, TeamDetail } from '../types/api';

interface PromptGetOptions {
  out?: string;
  promptsDir?: string;
  raw: boolean;
  force: boolean;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
}

function defaultPromptPath(team: string, slug: string, promptsDir?: string): string {
  const root = promptsDir ? path.resolve(promptsDir) : path.join(smskillHome(), 'prompts');
  return path.join(root, team, `${slug}.md`);
}

async function resolvePromptTeam(api: ReturnType<typeof createApi>, team: string | undefined): Promise<string> {
  if (!team) throw userError('team required: use <team>/<prompt> or set defaultTeamId');
  if (/^\d+$/.test(team)) {
    const detail = await api.get<TeamDetail>(`/api/teams/${encodeURIComponent(team)}/detail`);
    if (!detail.slug) throw userError(`team ${team} has no slug`);
    return detail.slug;
  }
  return team;
}

export async function exportPrompt(ref: string, opts: PromptGetOptions): Promise<{ file: string; slug: string }> {
  const c = loadConfig();
  const parsed = parsePromptRef(ref, c.defaultTeamId);
  const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
  const team = await resolvePromptTeam(api, parsed.team);
  const detail = await api.get<PromptDetail>(`/api/teams/${encodeURIComponent(team)}/prompts/${encodeURIComponent(parsed.slug)}`);
  const dl = `/api/teams/${encodeURIComponent(team)}/prompts/${encodeURIComponent(parsed.slug)}/download?raw=${opts.raw ? 'true' : 'false'}`;
  const buf = await api.downloadBytes(dl);
  const file = opts.out ? path.resolve(opts.out) : defaultPromptPath(detail.teamSlug ?? team, parsed.slug, opts.promptsDir);
  if (fs.existsSync(file) && !opts.force) {
    throw userError(`file already exists: ${file} (use --force)`);
  }
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, buf);
  upsertEntry({
    slug: parsed.slug,
    name: detail.name,
    version: detail.version ?? 'unknown',
    agent: 'generic',
    scope: 'user',
    path: file,
    source: 'skillstack-prompt',
    apiBaseUrl: c.apiBaseUrl,
    downloadPath: dl,
    installedAt: new Date().toISOString(),
  });
  return { file, slug: parsed.slug };
}

export function registerPrompt(root: Command): void {
  const prompt = root.command('prompt').description('Browse and export prompts');

  prompt.command('search <query>')
    .description('Search public prompts')
    .option('--limit <n>', 'page size', '20')
    .option('--json', 'raw JSON output', false)
    .action(async (query: string, opts: { limit: string; json: boolean }) => {
      const c = loadConfig();
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 20));
      const page = await api.get<PageResult<PromptCard>>(
        `/api/prompts?size=${limit}&page=1&q=${encodeURIComponent(query.trim())}`,
      );
      if (opts.json) { console.log(JSON.stringify(page, null, 2)); return; }
      const rows = (page.items ?? []).map(p => [
        p.teamSlug ? `${p.teamSlug}/${p.slug}` : p.slug,
        p.name,
        p.version ?? '-',
        p.exports ?? 0,
        p.visibility ?? '-',
      ]);
      info(renderTable(['ref', 'name', 'version', 'exports', 'visibility'], rows));
    });

  prompt.command('info <ref>')
    .description('Show prompt metadata')
    .action(async (ref: string) => {
      const c = loadConfig();
      const parsed = parsePromptRef(ref, c.defaultTeamId);
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const team = await resolvePromptTeam(api, parsed.team);
      const detail = await api.get<PromptDetail>(`/api/teams/${encodeURIComponent(team)}/prompts/${encodeURIComponent(parsed.slug)}`);
      info(`${detail.name} (${detail.teamSlug ?? parsed.team}/${detail.slug})`);
      info(`  version: ${detail.version ?? '-'}    visibility: ${detail.visibility ?? '-'}    exports: ${detail.exports ?? 0}`);
      if (detail.shortDesc) info(`  ${detail.shortDesc}`);
    });

  prompt.command('get <ref>')
    .description('Export a prompt as markdown')
    .option('--out <file>', 'write to exact file')
    .option('--prompts-dir <dir>', 'prompt export root')
    .option('--raw', 'preserve prompt references instead of resolving', false)
    .option('--force', 'overwrite existing file', false)
    .action(async (ref: string, opts: PromptGetOptions) => {
      const res = await exportPrompt(ref, opts);
      ok(`Exported ${res.slug} → ${res.file}`);
    });
}
