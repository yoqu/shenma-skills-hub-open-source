import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop window mode activation', () => {
  it('brings the window to the foreground after browser authorization returns', () => {
    const main = readFileSync(new URL('../../electron/main.cts', import.meta.url), 'utf8');
    const setWindowModeBody = main.match(/async function setWindowMode[\s\S]*?\n}\n\napp\.whenReady/)?.[0] || '';

    expect(setWindowModeBody).toContain('window.show()');
    expect(setWindowModeBody).toContain('window.focus()');
    expect(setWindowModeBody).toContain('app.focus()');
  });
});
