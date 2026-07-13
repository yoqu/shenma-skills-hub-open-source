import readline from 'node:readline';
import { Writable } from 'node:stream';
import chalk from 'chalk';

export interface AskOptions {
  defaultValue?: string;
  trim?: boolean;
}

export async function ask(question: string, opts: AskOptions = {}): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const suffix = opts.defaultValue ? ` (${opts.defaultValue})` : '';
  try {
    const answer: string = await new Promise(resolve => {
      rl.question(`${question}${suffix}: `, resolve);
    });
    const value = opts.trim === false ? answer : answer.trim();
    if (!value && opts.defaultValue !== undefined) return opts.defaultValue;
    return value;
  } finally {
    rl.close();
  }
}

export interface SelectChoice<T> {
  label: string;
  value: T;
  hint?: string;
}

/**
 * Arrow-key picker (↑/↓ to move, Enter to confirm, Esc / Ctrl-C to cancel,
 * 1..9 as shortcut). Falls back to a numbered prompt on non-TTY stdin.
 */
export async function select<T>(
  question: string,
  choices: SelectChoice<T>[],
  initialIndex = 0,
): Promise<T> {
  if (choices.length === 0) throw new Error('select: no choices');
  const startIdx = Math.min(Math.max(initialIndex, 0), choices.length - 1);

  if (!process.stdin.isTTY) {
    process.stdout.write(`${question}\n`);
    choices.forEach((c, i) => {
      const hint = c.hint ? ` — ${c.hint}` : '';
      process.stdout.write(`  ${i + 1}) ${c.label}${hint}\n`);
    });
    const raw = await ask(`输入 1-${choices.length}`, { defaultValue: String(startIdx + 1) });
    const n = parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 1 || n > choices.length) throw new Error(`无效选项: ${raw}`);
    return choices[n - 1].value;
  }

  return new Promise<T>((resolve, reject) => {
    let idx = startIdx;
    let first = true;

    const stdin = process.stdin;
    const stdout = process.stdout;

    function paint() {
      if (!first) readline.moveCursor(stdout, 0, -choices.length);
      first = false;
      for (let i = 0; i < choices.length; i++) {
        readline.cursorTo(stdout, 0);
        readline.clearLine(stdout, 0);
        const c = choices[i];
        const marker = i === idx ? chalk.cyan('▸') : ' ';
        const label = i === idx ? chalk.cyan(c.label) : c.label;
        const hint = c.hint ? chalk.dim(`  ${c.hint}`) : '';
        stdout.write(`  ${marker} ${label}${hint}\n`);
      }
    }

    function cleanup() {
      stdin.removeListener('keypress', onKey);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    }

    function onKey(_str: string, key: { name?: string; ctrl?: boolean; sequence?: string }) {
      if (!key) return;
      if (key.ctrl && key.name === 'c') {
        cleanup();
        stdout.write('\n');
        reject(new Error('cancelled'));
        return;
      }
      if (key.name === 'escape') {
        cleanup();
        stdout.write('\n');
        reject(new Error('cancelled'));
        return;
      }
      if (key.name === 'up' || key.name === 'k') {
        idx = (idx - 1 + choices.length) % choices.length;
        paint();
        return;
      }
      if (key.name === 'down' || key.name === 'j') {
        idx = (idx + 1) % choices.length;
        paint();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(choices[idx].value);
        return;
      }
      const n = parseInt(key.sequence ?? '', 10);
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
        idx = n - 1;
        paint();
      }
    }

    stdout.write(`${chalk.bold(question)} ${chalk.dim('(↑/↓ 选择，Enter 确认，Esc 取消)')}\n`);
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    paint();
    stdin.on('keypress', onKey);
  });
}

export async function askHidden(question: string): Promise<string> {
  let muted = false;
  const mutableStdout = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk as Buffer);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: mutableStdout, terminal: true });
  try {
    const answer: string = await new Promise(resolve => {
      rl.question(`${question}: `, resolve);
      muted = true;
    });
    process.stdout.write('\n');
    return answer;
  } finally {
    rl.close();
  }
}
