import axios from 'axios';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { renderTable } from '../render/table';
import { info } from '../render/log';
import type { PageResult, SkillCard } from '../types/api';

export function registerSearch(root: Command): void {
  root.command('search [query...]')
    .description('Search the public skill plaza')
    .option('--limit <n>', 'page size', '20')
    .option('--json', 'output raw JSON', false)
    .action(async (queryArr: string[], opts: { limit: string; json: boolean }) => {
      const c = loadConfig();
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const q = (queryArr || []).join(' ').trim();
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 20));
      const params = new URLSearchParams({ size: String(limit), page: '1' });
      if (q) params.set('keyword', q);
      const page = await api.get<PageResult<SkillCard>>(`/api/skills?${params.toString()}`);
      if (opts.json) { console.log(JSON.stringify(page, null, 2)); return; }
      const rows = (page.items ?? []).map(s => [
        s.slug, s.name, s.version ?? '-', s.installs ?? 0, s.stars ?? 0, s.safety ?? '-', s.team ?? '-',
      ]);
      info(renderTable(['slug', 'name', 'version', 'installs', 'stars', 'safety', 'team'], rows));
      info(`(${rows.length} of ${page.total} results)`);
    });
}
