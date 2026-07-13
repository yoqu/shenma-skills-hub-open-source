import axios from 'axios';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { renderTable } from '../render/table';
import { ok, fail, info, warn } from '../render/log';
import { parseSuiteRef } from '../core/suiteRef';
import { installSkill } from './install';
import { exportPrompt } from './prompt';
import type { PageResult, SuiteListItem, SuiteDetail, SuiteAssetItem } from '../types/api';
import type { Agent, Scope } from '../core/target';
import { userError, CliError } from '../core/errors';

export function registerSuite(root: Command): void {
  const suite = root.command('suite').description('Browse and install suites');

  suite.command('list')
    .description('List suites for the configured team')
    .option('--team <id>', 'override teamId')
    .option('--limit <n>', 'page size', '20')
    .option('--json', 'raw JSON output', false)
    .action(async (opts: { team?: string; limit: string; json: boolean }) => {
      const c = loadConfig();
      const teamId = opts.team ? Number(opts.team) : c.defaultTeamId;
      if (!teamId || !Number.isInteger(teamId) || teamId <= 0) {
        throw userError('teamId required: pass --team <id> or set defaultTeamId');
      }
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 20));
      const page = await api.get<PageResult<SuiteListItem>>(`/api/teams/${teamId}/suites?size=${limit}&page=1`);
      if (opts.json) { console.log(JSON.stringify(page, null, 2)); return; }
      const rows = (page.items ?? []).map(s => [
        s.slug, s.name, s.skills ?? 0, s.installs ?? 0, s.visibility ?? '-', (s.updatedAt ?? '').slice(0, 10),
      ]);
      info(renderTable(['slug', 'name', 'skills', 'installs', 'visibility', 'updated'], rows));
    });

  suite.command('info <ref>')
    .description('Show suite metadata + included skills. ref = "<teamId>/<slug>" or "<slug>"')
    .action(async (ref: string) => {
      const c = loadConfig();
      const { teamId, slug } = parseSuiteRef(ref, c.defaultTeamId);
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const detail = await api.get<SuiteDetail>(`/api/teams/${teamId}/suites/by-slug/${encodeURIComponent(slug)}`);
      const items: SuiteAssetItem[] = detail.items?.length
        ? detail.items
        : detail.skills.map(s => ({ type: 'SKILL', id: s.id, slug: s.slug, name: s.name, version: s.version, position: s.position, installs: s.installs }));
      info(`${detail.name} (${detail.slug}, team=${detail.teamSlug ?? detail.teamId})`);
      info(`  visibility: ${detail.visibility ?? '-'}    installs: ${detail.installs ?? 0}    items: ${items.length}`);
      if (detail.desc) info(`  ${detail.desc}`);
      info('');
      const rows = items.map(s => [
        s.position,
        s.type.toLowerCase(),
        s.slug,
        s.name,
        s.version ?? '-',
        s.type === 'PROMPT' ? (s.exports ?? 0) : (s.installs ?? 0),
      ]);
      info(renderTable(['pos', 'type', 'slug', 'name', 'version', 'uses'], rows));
    });

  suite.command('install <ref>')
    .description('Install every skill in the suite to the same target')
    .option('--agent <agent>')
    .option('--scope <scope>')
    .option('--dir <dir>')
    .option('--force', 'use --force per skill', false)
    .option('--prompts-dir <dir>', 'prompt export root')
    .option('--raw', 'export raw prompt markdown with references preserved', false)
    .option('--no-continue-on-error', 'stop at first failed skill (default: continue)')
    .action(async (ref: string, opts: { agent?: string; scope?: string; dir?: string; promptsDir?: string; raw: boolean; force: boolean; continueOnError: boolean }) => {
      const c = loadConfig();
      const agent = (opts.agent ?? c.defaultAgent) as Agent;
      const scope = (opts.scope ?? c.defaultScope) as Scope;
      const { teamId, slug } = parseSuiteRef(ref, c.defaultTeamId);
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const detail = await api.get<SuiteDetail>(`/api/teams/${teamId}/suites/by-slug/${encodeURIComponent(slug)}`);

      const continueOnError = opts.continueOnError !== false;
      const suiteRef = `${teamId}/${slug}`;
      const items: SuiteAssetItem[] = detail.items?.length
        ? detail.items
        : detail.skills.map(s => ({ type: 'SKILL', id: s.id, slug: s.slug, name: s.name, version: s.version, position: s.position, installs: s.installs }));
      info(`Installing suite ${suiteRef} (${items.length} items)`);

      const succeeded: string[] = [];
      const failed: Array<{ slug: string; reason: string }> = [];
      for (const s of items) {
        const slugAtVersion = s.type === 'SKILL' && s.version ? `${s.slug}@${s.version}` : s.slug;
        try {
          if (s.type === 'PROMPT') {
            const r = await exportPrompt(`${detail.teamSlug ?? teamId}/${s.slug}`, {
              promptsDir: opts.promptsDir,
              raw: opts.raw,
              force: opts.force,
            });
            ok(`  prompt:${s.slug} → ${r.file}`);
            succeeded.push(`prompt:${s.slug}`);
          } else {
            const r = await installSkill(slugAtVersion, {
              agents: [agent], scope, dir: opts.dir, force: opts.force,
              viaSuite: { suite: suiteRef, suiteId: detail.id },
            });
            const where = r.targets.map(t => t.path).join(', ') || r.contentPath;
            ok(`  ${slugAtVersion} → ${where}`);
            succeeded.push(slugAtVersion);
          }
        } catch (e) {
          const reason = (e as Error).message ?? String(e);
          fail(`  ${slugAtVersion}   ${reason}`);
          failed.push({ slug: slugAtVersion, reason });
          if (!continueOnError) break;
        }
      }

      try { await api.post(`/api/suites/${detail.id}/install`, {}); }
      catch { warn('installed locally but failed to bump suite install counter on server'); }

      info('');
      info(`Summary: ${succeeded.length} installed/exported, ${failed.length} failed`);
      if (failed.length > 0) throw new CliError(2, `${failed.length} item(s) failed to install`);
    });
}
