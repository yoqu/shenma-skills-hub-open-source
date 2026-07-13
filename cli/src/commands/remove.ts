import fs from 'node:fs';
import { Command } from 'commander';
import { findEntries, removeEntry, readLockfile } from '../core/lockfile';
import { ok, info, warn } from '../render/log';
import { userError } from '../core/errors';
import type { Agent, Scope } from '../core/target';

export function registerRemove(root: Command): void {
  root.command('remove <slug>')
    .description('Uninstall a skill (deletes target directory + lockfile entry)')
    .option('--agent <agent>')
    .option('--scope <scope>')
    .action((slug: string, opts: { agent?: string; scope?: string }) => {
      const matches = findEntries({
        slug,
        agent: opts.agent as Agent | undefined,
        scope: opts.scope as Scope | undefined,
      });
      if (matches.length === 0) {
        throw userError(`no installed skill matches "${slug}". Run "smskill list" to see installed skills.`);
      }
      if (matches.length > 1) {
        const hint = matches.map(m => `  ${m.slug} (agent=${m.agent}, scope=${m.scope}, path=${m.path})`).join('\n');
        throw userError(`multiple matches for "${slug}"; narrow with --agent / --scope:\n${hint}`);
      }
      const e = matches[0];
      // 删除 agent 可见路径（软链只断链、不动真实内容）。
      if (fs.existsSync(e.path) || isSymlink(e.path)) {
        try { fs.rmSync(e.path, { recursive: true, force: true }); }
        catch (err) { warn(`failed to remove ${e.path}: ${(err as Error).message}`); }
      }
      removeEntry({ slug: e.slug, agent: e.agent, scope: e.scope, path: e.path });

      // 软链模式：当没有其他 agent 再引用同一个 store 时，回收真实内容目录。
      if (e.store) {
        const stillUsed = readLockfile().entries.some(x => x.store === e.store);
        if (!stillUsed && fs.existsSync(e.store)) {
          try { fs.rmSync(e.store, { recursive: true, force: true }); info(`  store cleaned: ${e.store}`); }
          catch (err) { warn(`failed to clean store ${e.store}: ${(err as Error).message}`); }
        }
      }
      ok(`Removed ${e.slug} (agent=${e.agent}, scope=${e.scope})`);
    });
}

/** 悬空软链 fs.existsSync 会返回 false，但仍需删除，所以用 lstat 单独判断。 */
function isSymlink(p: string): boolean {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}
