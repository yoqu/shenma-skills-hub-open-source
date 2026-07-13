import axios from 'axios';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { renderTable } from '../render/table';
import { info } from '../render/log';
import type { SkillDetail, SkillVersionItem } from '../types/api';
import { parseSkillRef } from '../core/skillRef';

export function registerInfo(root: Command): void {
  root.command('info <slug>')
    .description('Show skill details + recent versions')
    .action(async (slugArg: string) => {
      const { slug } = parseSkillRef(slugArg);
      const c = loadConfig();
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const [detail, versions] = await Promise.all([
        api.get<SkillDetail>(`/api/skills/${encodeURIComponent(slug)}`),
        api.get<SkillVersionItem[]>(`/api/skills/${encodeURIComponent(slug)}/versions`),
      ]);
      info(`${detail.name} (${detail.slug})`);
      const teamLabel = typeof detail.team === 'string'
        ? detail.team
        : (detail.team?.slug ?? detail.team?.name ?? '-');
      info(`  team: ${teamLabel}    visibility: ${detail.visibility ?? '-'}    safety: ${detail.safety ?? '-'}`);
      if (detail.shortDesc) info(`  ${detail.shortDesc}`);
      info('');
      const rows = versions.slice(0, 5).map(v => [
        v.latest ? `${v.version} *` : v.version,
        v.date ?? '-',
        v.installs ?? 0,
        (v.note ?? '').slice(0, 60),
      ]);
      info(renderTable(['version', 'date', 'installs', 'note'], rows));
    });
}
