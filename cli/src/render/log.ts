import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export const ok = (msg: string) => console.log(chalk.green('✓ ') + msg);
export const fail = (msg: string) => console.error(chalk.red('✖ ') + msg);
export const warn = (msg: string) => console.error(chalk.yellow('⚠ ') + msg);
export const info = (msg: string) => console.log(msg);

export function spinner(text: string): Ora {
  return ora(text).start();
}
