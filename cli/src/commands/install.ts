import axios from 'axios';
import fs from 'node:fs';
import { Command } from 'commander';
import { loadConfig, type Config } from '../core/config';
import { createApi } from '../core/api';
import { extractStrippedZip, clearTargetDir, linkSkill } from '../core/install';
import { upsertEntry, type LockEntry } from '../core/lockfile';
import { buildInstallPlan, INSTALL_AGENTS, type Agent, type Scope } from '../core/target';
import { parseSkillRef } from '../core/skillRef';
import type { SkillDetail } from '../types/api';
import { ok, info, warn } from '../render/log';
import { userError } from '../core/errors';

export interface InstallOptions {
  /** 真实要安装到的 agent 列表；direct 模式仅用 agents[0] 作为 lockfile 标签。 */
  agents: Agent[];
  scope: Scope;
  dir?: string;
  force: boolean;
  viaSuite?: { suite: string; suiteId: number };
}

export interface InstallResult {
  slug: string;
  version: string;
  /** 真实内容落地目录。 */
  contentPath: string;
  /** 每个 agent 的可见路径（软链或直装目录）。 */
  targets: Array<{ agent: Agent; path: string }>;
}

export async function installSkill(slugArg: string, opts: InstallOptions): Promise<InstallResult> {
  const { slug, version } = parseSkillRef(slugArg);
  const c = loadConfig();
  const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });

  const detail = await api.get<SkillDetail>(`/api/skills/${encodeURIComponent(slug)}`);
  const plan = buildInstallPlan({ slug, agents: opts.agents, scope: opts.scope, cwd: process.cwd(), dir: opts.dir });

  if (fs.existsSync(plan.contentPath)) {
    if (!opts.force) {
      throw userError(`install path already exists: ${plan.contentPath} (use --force or run "smskill remove ${slug}")`);
    }
    clearTargetDir(plan.contentPath);
  }

  const dlPath = `/api/skills/${encodeURIComponent(slug)}/download${version ? `?version=${encodeURIComponent(version)}` : ''}`;
  const buf = await api.downloadBytes(dlPath);
  await extractStrippedZip(buf, plan.contentPath);

  const effectiveVersion = version ?? detail.version ?? 'unknown';
  const base = {
    slug,
    name: detail.name,
    version: effectiveVersion,
    scope: opts.scope,
    source: 'skillstack' as const,
    apiBaseUrl: c.apiBaseUrl,
    downloadPath: dlPath,
    installedAt: new Date().toISOString(),
    ...(opts.viaSuite ? { via: opts.viaSuite } : {}),
  };

  const targets: Array<{ agent: Agent; path: string }> = [];
  if (plan.direct) {
    const agent = opts.agents[0] ?? 'claude';
    const entry: LockEntry = { ...base, agent, path: plan.contentPath };
    upsertEntry(entry);
    targets.push({ agent, path: plan.contentPath });
  } else {
    for (const t of plan.targets) {
      linkSkill(t.linkPath, plan.contentPath);
      const entry: LockEntry = { ...base, agent: t.agent, path: t.linkPath, store: plan.contentPath };
      upsertEntry(entry);
      targets.push({ agent: t.agent, path: t.linkPath });
    }
  }

  try { await api.post(`/api/skills/${detail.id}/install`, {}); }
  catch { warn(`installed locally but failed to bump install counter on server`); }

  return { slug, version: effectiveVersion, contentPath: plan.contentPath, targets };
}

function parseAgents(raw: string): Agent[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean) as Agent[];
}

/**
 * 决定本次安装的 agent 列表，优先级：
 * `--dir`（直装，仅打标签）> `--agent`（显式，可逗号多选）> `-y`（全部支持的 agent）
 * > 交互式多选（TTY 下 ↑↓ + 空格）> 非交互回退到 defaultAgent。
 */
async function resolveAgents(
  opts: { agent?: string; dir?: string; yes?: boolean },
  c: Config,
): Promise<Agent[]> {
  const fallback = (c.defaultAgent as Agent) ?? 'claude';
  if (opts.dir) return [(opts.agent as Agent) ?? fallback];
  if (opts.agent) return parseAgents(opts.agent);
  if (opts.yes) return [...INSTALL_AGENTS];
  if (process.stdout.isTTY && process.stdin.isTTY) {
    const { default: checkbox } = await import('@inquirer/checkbox');
    const selected = await checkbox<Agent>({
      message: '选择要安装到哪些 agent (↑↓ 移动, 空格选择, 回车确认)',
      choices: INSTALL_AGENTS.map(a => ({ name: a, value: a, checked: true })),
    });
    if (selected.length === 0) throw userError('未选择任何 agent，已取消安装');
    return selected;
  }
  return [fallback];
}

export function registerInstall(root: Command): void {
  root.command('install <slug>')
    .description('Install a skill into the chosen agent directories (软链到 ~/.agents/skills)')
    .option('--agent <agent>', 'claude | codex | openclaw | generic（逗号分隔可多选）')
    .option('--scope <scope>', 'user | project')
    .option('--dir <dir>', 'override install root entirely（真实解压，不建软链）')
    .option('-y, --yes', 'install to all supported agents without prompting', false)
    .option('--force', 'overwrite existing install', false)
    .action(async (slug: string, opts: { agent?: string; scope?: string; dir?: string; yes?: boolean; force: boolean }) => {
      const c = loadConfig();
      const scope = (opts.scope ?? c.defaultScope) as Scope;
      const agents = await resolveAgents(opts, c);
      const res = await installSkill(slug, { agents, scope, dir: opts.dir, force: opts.force });

      if (opts.dir) {
        ok(`Installed ${res.slug}@${res.version} → ${res.targets[0]?.path ?? res.contentPath} (scope=${scope})`);
        return;
      }
      ok(`Installed ${res.slug}@${res.version} (scope=${scope})`);
      info(`  content: ${res.contentPath}`);
      for (const t of res.targets) info(`  ${t.agent} → ${t.path}`);
    });
}
