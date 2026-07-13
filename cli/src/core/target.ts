import os from 'node:os';
import path from 'node:path';

export type Agent = 'claude' | 'codex' | 'openclaw' | 'generic';
export type Scope = 'user' | 'project';

export interface ResolveTargetInput {
  agent: Agent;
  scope: Scope;
  cwd: string;
  dir?: string;
}

const VALID_AGENTS: Agent[] = ['claude', 'codex', 'openclaw', 'generic'];
const VALID_SCOPES: Scope[] = ['user', 'project'];

/** 交互式多选时暴露给用户的 agent。当前只支持 claude / codex。 */
export const INSTALL_AGENTS: Agent[] = ['claude', 'codex'];

/**
 * 真实 skill 内容的统一落地仓库根目录。所有被选中的 agent 都软链到这里，
 * 而不是各自复制一份：
 * - user scope: `~/.agents/skills`
 * - project scope: `<cwd>/.agents/skills`
 */
export function agentsStoreRoot(scope: Scope, cwd: string): string {
  const home = os.homedir();
  return scope === 'user'
    ? path.join(home, '.agents', 'skills')
    : path.join(cwd, '.agents', 'skills');
}

export interface InstallTarget {
  agent: Agent;
  /** agent 目录下指向 store 的软链路径，如 `~/.claude/skills/<slug>`。 */
  linkPath: string;
}

export interface InstallPlan {
  /** true 表示 `--dir` 直装模式：真实解压到 contentPath，不建任何软链。 */
  direct: boolean;
  /** 真实文件落地目录。 */
  contentPath: string;
  /** 需要建立的 agent 软链；direct 模式为空数组。 */
  targets: InstallTarget[];
}

export interface BuildInstallPlanInput {
  slug: string;
  agents: Agent[];
  scope: Scope;
  cwd: string;
  dir?: string;
}

/**
 * 计算一次安装的落地方案：
 * - 指定 `--dir`：真实解压到 `<dir>/<slug>`，不建软链（保留旧的直装语义）。
 * - 否则：真实内容放进 `agentsStoreRoot/<slug>`，每个选中的 agent 在自己的 skills
 *   目录下建一个指向该内容的软链。
 */
export function buildInstallPlan(input: BuildInstallPlanInput): InstallPlan {
  const { slug, agents, scope, cwd, dir } = input;
  if (dir) {
    return { direct: true, contentPath: path.join(path.resolve(dir), slug), targets: [] };
  }
  const contentPath = path.join(agentsStoreRoot(scope, cwd), slug);
  const targets: InstallTarget[] = agents.map(agent => ({
    agent,
    linkPath: path.join(resolveTarget({ agent, scope, cwd }), slug),
  }));
  return { direct: false, contentPath, targets };
}

export function resolveTarget(input: ResolveTargetInput): string {
  if (input.dir) return path.resolve(input.dir);
  if (!VALID_AGENTS.includes(input.agent)) {
    throw new Error(`unknown agent: ${input.agent}`);
  }
  if (!VALID_SCOPES.includes(input.scope)) {
    throw new Error(`unknown scope: ${input.scope}`);
  }
  const home = os.homedir();
  const { agent, scope, cwd } = input;
  if (agent === 'claude') {
    return scope === 'user'
      ? path.join(home, '.claude', 'skills')
      : path.join(cwd, '.claude', 'skills');
  }
  if (agent === 'codex') {
    return scope === 'user'
      ? path.join(home, '.codex', 'skills')
      : path.join(cwd, '.codex', 'skills');
  }
  if (agent === 'openclaw') {
    return scope === 'user'
      ? path.join(home, '.openclaw', 'skills')
      : path.join(cwd, 'skills');
  }
  // generic
  return scope === 'user'
    ? path.join(home, '.smskill', 'skills')
    : path.join(cwd, 'skills');
}
