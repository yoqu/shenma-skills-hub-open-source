import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildApiProxyUrl,
  createApiProxyResponse,
  proxyApiRequest,
  serializeProxyQueryParams,
  type ApiProxyRequest,
} from '../../electron/apiProxy';
import { createDesktopLogger, createMemoryLogWriter } from '../../electron/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiProxy', () => {
  it('builds API URLs from backend origins and relative renderer paths', () => {
    const url = buildApiProxyUrl({
      apiBaseUrl: 'https://skillstack.example.com',
      url: '/site/branding',
      params: { q: 'skill', tag: ['desktop', 'api'] },
    });

    expect(url.toString()).toBe('https://skillstack.example.com/api/site/branding?q=skill&tag=desktop&tag=api');
  });

  it('rejects non-http backend addresses', () => {
    expect(() => buildApiProxyUrl({
      apiBaseUrl: 'file:///tmp/skillstack',
      url: '/site/branding',
    })).toThrow('INVALID_API_BASE_URL');
  });

  it('turns fetch responses into serializable renderer responses', async () => {
    const response = new Response(JSON.stringify({ code: 0, data: { ok: true } }), {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'x-auth-reset': '0',
      },
    });

    await expect(createApiProxyResponse(response)).resolves.toEqual({
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'x-auth-reset': '0',
      },
      data: { code: 0, data: { ok: true } },
    });
  });

  it('passes the built URL and request options to fetch', async () => {
    const request: ApiProxyRequest = {
      apiBaseUrl: 'https://skillstack.example.com/api',
      method: 'POST',
      url: '/skills/versions/parse',
      headers: { 'content-type': 'application/json' },
      body: '{"zipUrl":"uploads/demo.zip"}',
    };
    const fetcher = vi.fn(async () => new Response('{"code":0,"data":{"ok":true}}', {
      headers: { 'content-type': 'application/json' },
    }));

    const result = await createApiProxyResponse(await fetcher(buildApiProxyUrl(request), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    }));

    expect(fetcher).toHaveBeenCalledWith(new URL('https://skillstack.example.com/api/skills/versions/parse'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"zipUrl":"uploads/demo.zip"}',
    });
    expect(result.data).toEqual({ code: 0, data: { ok: true } });
  });

  it('logs HTTP failures with request and response bodies', async () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date(2026, 5, 4, 2, 12, 33),
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: 40004, message: 'slug invalid' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }));

    await proxyApiRequest({
      method: 'POST',
      url: '/user-skills/import',
      body: { slug: 'bad slug', token: 'secret' },
    }, 'http://localhost:8080', fetcher, { logger, requestId: 'api_1' });

    const output = writer.lines.join('\n');
    expect(output).toContain('POST /api/user-skills/import failed');
    expect(output).toContain('status=400');
    expect(output).toContain('requestId=api_1');
    expect(output).toContain('requestBody={"slug":"bad slug","token":"<redacted>"}');
    expect(output).toContain('responseBody={"code":40004,"message":"slug invalid"}');
  });

  it('logs backend envelope failures returned with 2xx status', async () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date(2026, 5, 4, 2, 12, 33),
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: 40004, message: 'slug invalid' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await proxyApiRequest({
      method: 'POST',
      url: '/user-skills/import',
      body: { slug: 'bad slug' },
    }, 'http://localhost:8080', fetcher, { logger, requestId: 'api_2' });

    const output = writer.lines.join('\n');
    expect(output).toContain('POST /api/user-skills/import failed');
    expect(output).toContain('status=200');
    expect(output).toContain('envelopeCode=40004');
    expect(output).toContain('responseBody={"code":40004,"message":"slug invalid"}');
  });

  it('logs network failures with request bodies', async () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date(2026, 5, 4, 2, 12, 33),
    });
    const fetcher = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(proxyApiRequest({
      method: 'POST',
      url: '/user-skills/import',
      body: { slug: 'bad slug' },
    }, 'http://localhost:8080', fetcher, { logger, requestId: 'api_3' })).rejects.toThrow('connect ECONNREFUSED');

    const output = writer.lines.join('\n');
    expect(output).toContain('POST /api/user-skills/import failed');
    expect(output).toContain('requestId=api_3');
    expect(output).toContain('requestBody={"slug":"bad slug"}');
    expect(output).toContain('error={"name":"Error","message":"connect ECONNREFUSED"');
  });

  it('logs slow successful API requests as warnings without logging normal successes', async () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date(2026, 5, 4, 2, 12, 33),
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: 0, data: { ok: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(4501);

    await proxyApiRequest({
      method: 'GET',
      url: '/site/branding',
    }, 'http://localhost:8080', fetcher, { logger, requestId: 'api_slow' });

    const output = writer.lines.join('\n');
    expect(output).toContain('[WARN][skillstack_desktop::api] slow API request');
    expect(output).toContain('durationMs=3501');
    expect(output).toContain('requestId=api_slow');

    writer.lines.length = 0;
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1200);

    await proxyApiRequest({
      method: 'GET',
      url: '/site/branding',
    }, 'http://localhost:8080', fetcher, { logger, requestId: 'api_fast' });

    expect(writer.lines).toEqual([]);
  });
});

describe('serializeProxyQueryParams', () => {
  it('drops empty query params and repeats array values', () => {
    expect(serializeProxyQueryParams({
      q: 'skill',
      empty: '',
      missing: undefined,
      tag: ['desktop', 'api'],
    })).toEqual([
      ['q', 'skill'],
      ['tag', 'desktop'],
      ['tag', 'api'],
    ]);
  });
});
