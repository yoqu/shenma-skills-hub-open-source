import { describe, expect, it } from 'vitest';
import { shouldLogDesktopOperationSuccess } from '../../electron/ipcLogging';

describe('desktop IPC logging policy', () => {
  it('does not log high-frequency successful operations', () => {
    expect(shouldLogDesktopOperationSuccess('api:request')).toBe(false);
    expect(shouldLogDesktopOperationSuccess('config:get')).toBe(false);
    expect(shouldLogDesktopOperationSuccess('local-installs:list')).toBe(false);
    expect(shouldLogDesktopOperationSuccess('window:mode')).toBe(false);
    expect(shouldLogDesktopOperationSuccess('log:event')).toBe(false);
  });

  it('keeps successful logs for user-visible mutating operations', () => {
    expect(shouldLogDesktopOperationSuccess('config:save')).toBe(true);
    expect(shouldLogDesktopOperationSuccess('skills:install')).toBe(true);
    expect(shouldLogDesktopOperationSuccess('skills:uninstall')).toBe(true);
  });
});
