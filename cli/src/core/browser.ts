import { exec } from 'node:child_process';

/**
 * Best-effort open a URL in the user's default browser. Returns whether the
 * spawn succeeded — callers should still print the URL so users can paste it
 * manually (SSH sessions, containers, etc).
 */
export function openInBrowser(url: string): Promise<boolean> {
  const platform = process.platform;
  let cmd: string;
  if (platform === 'darwin') cmd = `open ${quote(url)}`;
  else if (platform === 'win32') cmd = `start "" ${quote(url)}`;
  else cmd = `xdg-open ${quote(url)}`;
  return new Promise(resolve => {
    exec(cmd, (err) => resolve(!err));
  });
}

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}
