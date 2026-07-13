import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { fetchMyTeams, matchTeam } from '../core/teams';
import type { MyTeam } from '../core/teams';
import { ok, info, warn } from '../render/log';
import { userError } from '../core/errors';
import type { CreateSkillRes, SkillParseResult, UploadTextRes } from '../types/api';

interface UploadOptions {
  team?: string;
  name?: string;
  slug?: string;
  desc?: string;
  cat?: string;
  visibility?: string;
  version?: string;
  tag?: string[];
  lang?: string[];
  draft: boolean;
}

function skillMdPath(input: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw userError(`path does not exist: ${resolved}`);
  const stat = fs.statSync(resolved);
  const file = stat.isDirectory() ? path.join(resolved, 'SKILL.md') : resolved;
  if (!fs.existsSync(file)) throw userError(`SKILL.md not found: ${file}`);
  if (!file.toLowerCase().endsWith('.md')) throw userError('upload expects a SKILL.md or markdown file');
  return file;
}

function frontmatter(content: string): Record<string, unknown> {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return {};
  const out: Record<string, unknown> = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2].trim();
    if (raw === '') {
      const arr: string[] = [];
      while (lines[i + 1]?.match(/^\s*-\s+/)) {
        i += 1;
        arr.push(lines[i].replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
      }
      out[key] = arr;
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      out[key] = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else {
      out[key] = raw.replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function slugify(input: string): string {
  const slug = input.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 95);
  return slug.length >= 2 ? slug : `skill-${Date.now()}`;
}

function pick<T>(...values: Array<T | undefined | null>): T | undefined {
  return values.find(v => v !== undefined && v !== null && String(v).trim() !== '') as T | undefined;
}

export function registerUpload(root: Command): void {
  root.command('upload <path>')
    .description('Upload a SKILL.md as a new SkillStack skill')
    .option('--team <idOrSlug>', 'team id or slug; defaults to your default team (set via `smskill team use`)')
    .option('--name <name>', 'override skill name')
    .option('--slug <slug>', 'override skill slug')
    .option('--desc <text>', 'override short description')
    .option('--cat <code>', 'category code: dev | data | design | doc | devops | ai', 'dev')
    .option('--visibility <value>', 'PUBLIC | TEAM_PRIVATE', 'TEAM_PRIVATE')
    .option('--version <semver>', 'skill version', '0.1.0')
    .option('--tag <tag>', 'tag; can be repeated', (v, acc: string[]) => [...acc, v], [])
    .option('--lang <lang>', 'language; can be repeated', (v, acc: string[]) => [...acc, v], [])
    .option('--draft', 'save as draft instead of submitting for review', false)
    .action(async (input: string, opts: UploadOptions) => {
      const file = skillMdPath(input);
      const content = fs.readFileSync(file, 'utf8');
      const meta = frontmatter(content);
      const c = loadConfig();
      const teamRef = pick(opts.team, c.defaultTeamId != null ? String(c.defaultTeamId) : undefined);
      if (!teamRef) {
        throw userError('team required: pass --team <id|slug> or set a default with `smskill team use <id|slug>`');
      }
      if (!c.token) throw userError('token required: set config.token or SMSKILL_TOKEN');

      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });

      // Resolve --team (id or slug) against the teams you belong to so a wrong target is caught early.
      const myTeams = await fetchMyTeams(api).catch(() => [] as MyTeam[]);
      const matched = matchTeam(myTeams, teamRef);
      let teamId: number;
      let teamLabel: string;
      if (matched) {
        teamId = matched.id;
        teamLabel = `${matched.id} (${matched.name} / ${matched.slug})`;
      } else {
        const n = Number(teamRef);
        if (Number.isInteger(n) && n > 0) {
          teamId = n;
          teamLabel = `${n}`;
          warn(`team ${n} is not among your teams; uploading by raw id (name unverified)`);
        } else {
          const avail = myTeams.length ? myTeams.map(t => `${t.id} ${t.slug}`).join(', ') : '(none)';
          throw userError(`team not found: "${teamRef}". pass a team id or one of your slugs: ${avail}`);
        }
      }
      const uploaded = await api.post<UploadTextRes>('/api/skills/versions/upload-text', { content });
      const parsed = await api.post<SkillParseResult>('/api/skills/versions/parse', { zipUrl: uploaded.zipUrl });
      if (!parsed.ok) {
        const failed = parsed.checks.filter(x => x.status === 'fail').map(x => `${x.name}: ${x.detail}`).join('; ');
        throw userError(`server rejected skill package${failed ? `: ${failed}` : ''}`);
      }

      const parsedMeta = parsed.parsed ?? {};
      const name = pick(opts.name, parsedMeta.name, meta.name, path.basename(path.dirname(file)))!;
      const description = pick(opts.desc, parsedMeta.description, meta.description, `Skill uploaded from ${path.basename(file)}`)!;
      const body = {
        name,
        slug: pick(opts.slug, slugify(String(meta.name ?? parsedMeta.name ?? name)))!,
        shortDesc: description,
        cat: pick(opts.cat, parsedMeta.category, meta.category, 'dev')!,
        visibility: opts.visibility ?? 'TEAM_PRIVATE',
        version: pick(opts.version, parsedMeta.version, meta.version, '0.1.0')!,
        teamId,
        tags: opts.tag?.length ? opts.tag : asList(parsedMeta.tags ?? meta.tags),
        langs: opts.lang?.length ? opts.lang : asList(parsedMeta.langs ?? meta.langs),
        fileCount: parsed.fileCount,
        zipUrl: uploaded.zipUrl,
        draft: opts.draft,
      };

      const res = await api.post<CreateSkillRes>('/api/skills', body);
      ok(`Uploaded ${res.slug} (${res.status})`);
      info(`  source: ${file}`);
      info(`  team: ${teamLabel}    version: ${body.version}    visibility: ${body.visibility}`);
      if (res.reviewId) info(`  reviewId: ${res.reviewId}`);
      if (res.pendingReview) warn('pending review before it becomes installable');
    });
}
