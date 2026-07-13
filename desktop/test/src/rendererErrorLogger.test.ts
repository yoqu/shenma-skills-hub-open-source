import { afterEach, describe, expect, it, vi } from 'vitest';
import * as rendererErrorLogger from '../../src/rendererErrorLogger';

describe('renderer error logger', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs window.onerror payload with route, stack and request id', async () => {
    const logEvent = vi.fn(async () => ({ ok: true, data: { logged: true } }));
    vi.stubGlobal('window', {
      location: { pathname: '/skills', search: '?tab=mine', hash: '#detail' },
      skillstackDesktop: { logEvent },
    });
    const error = Object.assign(new Error('render failed'), { requestId: 'api_123' });

    await (rendererErrorLogger as any).logWindowError('render failed', error);

    expect(logEvent).toHaveBeenCalledWith({
      level: 'error',
      moduleName: 'skillstack_desktop::renderer',
      message: 'render failed',
      fields: expect.objectContaining({
        kind: 'runtime_error',
        route: '/skills?tab=mine#detail',
        requestId: 'api_123',
        stack: expect.stringContaining('render failed'),
      }),
    });
  });

  it('logs unhandled rejections with the rejection stack summary', async () => {
    const logEvent = vi.fn(async () => ({ ok: true, data: { logged: true } }));
    vi.stubGlobal('window', {
      location: { pathname: '/settings', search: '', hash: '' },
      skillstackDesktop: { logEvent },
    });

    await (rendererErrorLogger as any).logUnhandledRejection(new Error('promise failed'));

    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      moduleName: 'skillstack_desktop::renderer',
      message: 'promise failed',
      fields: expect.objectContaining({
        kind: 'unhandled_rejection',
        route: '/settings',
        stack: expect.stringContaining('promise failed'),
      }),
    }));
  });

  it('does not throw when the desktop bridge log call fails', async () => {
    vi.stubGlobal('window', {
      location: { pathname: '/settings', search: '', hash: '' },
      skillstackDesktop: {
        logEvent: vi.fn(async () => {
          throw new Error('bridge unavailable');
        }),
      },
    });

    await expect((rendererErrorLogger as any).logUnhandledRejection(new Error('promise failed'))).resolves.toBeUndefined();
  });
});
