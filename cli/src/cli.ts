#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuth } from './commands/auth';
import { registerConfig } from './commands/config';
import { registerTeam } from './commands/team';
import { registerSearch } from './commands/search';
import { registerInfo } from './commands/info';
import { registerInstall } from './commands/install';
import { registerList } from './commands/list';
import { registerRemove } from './commands/remove';
import { registerSuite } from './commands/suite';
import { registerUpload } from './commands/upload';
import { registerPrompt } from './commands/prompt';
import { CliError } from './core/errors';

async function main(): Promise<void> {
  const program = new Command();
  program.name('smskill').description('SkillStack terminal client').version('0.2.0');
  registerAuth(program);
  registerConfig(program);
  registerTeam(program);
  registerSearch(program);
  registerInfo(program);
  registerInstall(program);
  registerList(program);
  registerRemove(program);
  registerSuite(program);
  registerPrompt(program);
  registerUpload(program);
  await program.parseAsync();
}

main().catch((e: unknown) => {
  if (e instanceof CliError) {
    console.error(`✖ ${e.message}`);
    process.exit(e.exitCode);
  }
  console.error(`✖ ${(e as Error).message ?? e}`);
  process.exit(2);
});
