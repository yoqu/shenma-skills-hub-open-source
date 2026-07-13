import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('DesktopSettingsPage', () => {
  it('provides a desktop log export entry', () => {
    const source = readFileSync(new URL('../../../src/pages/DesktopSettingsPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('exportDesktopLogs');
    expect(source).toContain('导出日志');
  });
});
