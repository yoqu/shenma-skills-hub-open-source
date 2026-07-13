import fs from 'node:fs';
import { Command } from 'commander';
import { findEntries } from '../core/lockfile';
import { renderTable } from '../render/table';
import { info } from '../render/log';
import type { Agent, Scope } from '../core/target';

export function registerList(root: Command): void {
  root.command('list')
    .description('List installed skills (from central lockfile)')
    .option('--agent <agent>')
    .option('--scope <scope>')
    .option('--suite <ref>', 'filter by via.suite ref, e.g. "1/onboarding-pack"')
    .action((opts: { agent?: string; scope?: string; suite?: string }) => {
      const rows = findEntries({
        agent: opts.agent as Agent | undefined,
        scope: opts.scope as Scope | undefined,
        suite: opts.suite,
      });
      if (rows.length === 0) { info('No skills installed yet.'); return; }
      const out = rows.map(e => [
        e.slug,
        e.version,
        e.agent,
        e.scope,
        fs.existsSync(e.path) ? e.path : `${e.path}  [missing]`,
        e.installedAt.slice(0, 19),
      ]);
      info(renderTable(['slug', 'version', 'agent', 'scope', 'path', 'installedAt'], out));
    });
}
