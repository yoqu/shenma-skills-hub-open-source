export type ExitCode = 0 | 1 | 2 | 3;

export class CliError extends Error {
  constructor(public readonly exitCode: ExitCode, message: string) {
    super(message);
  }
}

export const userError = (m: string) => new CliError(1, m);
export const networkError = (m: string) => new CliError(2, m);
export const fsError = (m: string) => new CliError(3, m);
