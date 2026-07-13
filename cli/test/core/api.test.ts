import { describe, it, expect, vi } from 'vitest';
import { createApi } from '../../src/core/api';
import { CliError } from '../../src/core/errors';

interface MockResp { status: number; data: unknown; }

function mockAxios(resps: MockResp[]) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string> }> = [];
  let i = 0;
  return {
    calls,
    request: vi.fn(async (cfg: { method: string; url: string; headers?: Record<string, string> }) => {
      calls.push({ method: cfg.method, url: cfg.url, headers: cfg.headers ?? {} });
      const r = resps[i++];
      if (!r) throw new Error('mock exhausted');
      if (r.status >= 400) {
        const err = new Error(`HTTP ${r.status}`) as Error & { response?: unknown };
        err.response = { status: r.status, data: r.data };
        throw err;
      }
      return { status: r.status, data: r.data };
    }),
  };
}

describe('api', () => {
  it('unwraps ApiResponse envelope on 200', async () => {
    const ax = mockAxios([{ status: 200, data: { code: 0, message: 'ok', data: { id: 1, name: 'x' } } }]);
    const api = createApi({ baseUrl: 'http://x', token: undefined, axios: ax });
    const out = await api.get<{ id: number; name: string }>('/api/skills/x');
    expect(out).toEqual({ id: 1, name: 'x' });
    expect(ax.calls[0].url).toBe('http://x/api/skills/x');
    expect(ax.calls[0].headers.Authorization).toBeUndefined();
  });

  it('attaches Bearer when token present', async () => {
    const ax = mockAxios([{ status: 200, data: { code: 0, message: 'ok', data: null } }]);
    const api = createApi({ baseUrl: 'http://x', token: 'lst_abc', axios: ax });
    await api.get('/api/skills/x');
    expect(ax.calls[0].headers.Authorization).toBe('Bearer lst_abc');
  });

  it('maps 401/40110 to CliError exit 2', async () => {
    const ax = mockAxios([
      { status: 401, data: { code: 40110, message: 'token失效', data: null } },
      { status: 401, data: { code: 40110, message: 'token失效', data: null } },
    ]);
    const api = createApi({ baseUrl: 'http://x', token: 'lst_x', axios: ax });
    await expect(api.get('/api/skills/x')).rejects.toBeInstanceOf(CliError);
    await expect(api.get('/api/skills/x').catch(e => (e as CliError).exitCode)).resolves.toBe(2);
  });

  it('maps non-zero envelope code on 200 to CliError exit 2', async () => {
    const ax = mockAxios([{ status: 200, data: { code: 40300, message: '无权', data: null } }]);
    const api = createApi({ baseUrl: 'http://x', token: 'lst_x', axios: ax });
    await expect(api.get('/api/skills/x')).rejects.toThrow(/40300/);
  });

  it('downloadBytes returns raw buffer', async () => {
    const buf = Buffer.from('PK fake zip');
    const ax = {
      request: vi.fn(async () => ({ status: 200, data: buf, headers: { 'content-type': 'application/zip' } })),
    };
    const api = createApi({ baseUrl: 'http://x', token: undefined, axios: ax });
    const out = await api.downloadBytes('/api/skills/x/download');
    expect(out).toEqual(buf);
  });
});
