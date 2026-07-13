import axios from 'axios';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  getLoginNotice,
  getToken,
  http,
  normalizeApiBaseUrl,
  resolveApiAssetUrl,
  resolveSkillDownloadUrl,
  setApiBaseUrl,
  setToken,
  subscribeSession,
  toSessionNotice,
} from '../../../src/api/client';

vi.mock('axios', () => {
  const handlers: {
    request?: (config: any) => any;
    responseSuccess?: (response: any) => any;
    responseError?: (error: any) => any;
  } = {};

  return {
    default: {
      create: vi.fn((config) => ({
        defaults: { baseURL: 'http://localhost:8080/api' },
        interceptors: {
          request: {
            use: vi.fn((handler) => {
              handlers.request = handler;
            }),
          },
          response: {
            use: vi.fn((success, error) => {
              handlers.responseSuccess = success;
              handlers.responseError = error;
            }),
          },
        },
        __handlers: handlers,
        __adapter: config?.adapter,
      })),
      isAxiosError: vi.fn((error) => Boolean(error?.isAxiosError || error?.code || error?.response)),
    },
  };
});

const mockedHttp = http as any;

beforeAll(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  });

  const eventTarget = new EventTarget();
  vi.stubGlobal('window', {
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    CustomEvent,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('resolveApiAssetUrl', () => {
  it('converts storage keys to upload URLs based on API origin', () => {
    http.defaults.baseURL = 'http://localhost:8080/api';

    expect(resolveApiAssetUrl('skill-versions/1/demo.zip'))
      .toBe('http://localhost:8080/uploads/skill-versions/1/demo.zip');
  });

  it('treats leading slash storage keys as upload paths, not root paths', () => {
    http.defaults.baseURL = 'http://localhost:8080/api';

    expect(resolveApiAssetUrl('/skill-versions/1/demo.zip'))
      .toBe('http://localhost:8080/uploads/skill-versions/1/demo.zip');
  });

  it('keeps absolute URLs unchanged', () => {
    expect(resolveApiAssetUrl('https://example.com/demo.zip')).toBe('https://example.com/demo.zip');
  });

  it('fixes absolute local storage URLs that miss /uploads prefix', () => {
    expect(resolveApiAssetUrl('http://localhost:8080/skill-versions/1/demo.zip'))
      .toBe('http://localhost:8080/uploads/skill-versions/1/demo.zip');
  });
});

describe('resolveSkillDownloadUrl', () => {
  it('builds the same package download endpoint used by smskill install', () => {
    http.defaults.baseURL = 'http://localhost:8080/api';

    expect(resolveSkillDownloadUrl('cloud-skill', '1.0.0'))
      .toBe('http://localhost:8080/api/skills/cloud-skill/download?version=1.0.0');
  });
});

describe('desktop API base URL', () => {
  it('normalizes backend origins to API base URLs', () => {
    expect(normalizeApiBaseUrl('http://localhost:8081'))
      .toBe('http://localhost:8081/api');
    expect(normalizeApiBaseUrl('http://localhost:8081/api/'))
      .toBe('http://localhost:8081/api');
  });

  it('updates runtime API URLs from desktop settings', () => {
    setApiBaseUrl('http://127.0.0.1:18080');

    expect(http.defaults.baseURL).toBe('http://127.0.0.1:18080/api');
    expect(resolveSkillDownloadUrl('cloud-skill'))
      .toBe('http://127.0.0.1:18080/api/skills/cloud-skill/download');
  });
});

describe('desktop api proxy adapter', () => {
  it('delegates desktop API requests to the Electron bridge', async () => {
    const apiRequest = vi.fn(async () => ({
      ok: true,
      data: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { code: 0, data: { name: 'SkillStack' } },
      },
    }));
    window.skillstackDesktop = {
      ...window.skillstackDesktop,
      apiRequest,
    } as any;
    const response = await mockedHttp.__adapter({
      baseURL: 'https://skillstack.example.com/api',
      url: '/site/branding',
      method: 'get',
      headers: { Authorization: 'Bearer token' },
      params: { preview: true },
    });

    expect(apiRequest).toHaveBeenCalledWith({
      apiBaseUrl: 'https://skillstack.example.com/api',
      method: 'GET',
      url: '/site/branding',
      headers: { Authorization: 'Bearer token' },
      params: { preview: true },
    });
    expect(response.data).toEqual({ code: 0, data: { name: 'SkillStack' } });
  });

  it('passes generated request ids through desktop API requests', async () => {
    const apiRequest = vi.fn(async () => ({
      ok: true,
      data: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { code: 0, data: { ok: true } },
      },
    }));
    window.skillstackDesktop = {
      ...window.skillstackDesktop,
      apiRequest,
    } as any;
    const config = mockedHttp.__handlers.request({
      baseURL: 'https://skillstack.example.com/api',
      url: '/user-skills/import',
      method: 'post',
      headers: {},
      data: { slug: 'demo' },
    });

    await mockedHttp.__adapter(config);

    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^api_/),
      body: { slug: 'demo' },
    }));
  });

  it('logs renderer fallback failures with request bodies', () => {
    const logEvent = vi.fn(async () => ({ ok: true, data: { logged: true } }));
    window.skillstackDesktop = {
      ...window.skillstackDesktop,
      logEvent,
    } as any;

    expect(() => mockedHttp.__handlers.responseSuccess({
      data: { code: 40004, message: 'slug invalid', data: null },
      status: 200,
      config: {
        url: '/user-skills/import',
        method: 'post',
        data: { slug: 'bad slug', token: 'secret' },
        metadata: { requestId: 'api_1' },
      },
    })).toThrow(ApiError);

    expect(logEvent).toHaveBeenCalledWith({
      level: 'error',
      moduleName: 'skillstack_desktop::renderer_api',
      message: 'POST /user-skills/import failed',
      fields: expect.objectContaining({
        requestId: 'api_1',
        fallback: true,
        status: 200,
        envelopeCode: 40004,
        requestBody: { slug: 'bad slug', token: 'secret' },
        responseBody: { code: 40004, message: 'slug invalid', data: null },
      }),
    });
  });

  it('simplifies renderer fallback logs when desktop proxy already recorded the API failure', () => {
    const logEvent = vi.fn(async () => ({ ok: true, data: { logged: true } }));
    window.skillstackDesktop = {
      ...window.skillstackDesktop,
      logEvent,
    } as any;

    expect(() => mockedHttp.__handlers.responseSuccess({
      data: { code: 40004, message: 'slug invalid', data: null },
      status: 200,
      config: {
        url: '/user-skills/import',
        method: 'post',
        data: { slug: 'bad slug' },
        metadata: {
          requestId: 'api_2',
          desktopProxyLoggedFailure: true,
        },
      },
    })).toThrow(ApiError);

    expect(logEvent).toHaveBeenCalledWith({
      level: 'error',
      moduleName: 'skillstack_desktop::renderer_api',
      message: 'POST /user-skills/import failed',
      fields: expect.objectContaining({
        requestId: 'api_2',
        fallback: true,
        mainLogged: true,
        status: 200,
        envelopeCode: 40004,
      }),
    });
    expect(logEvent.mock.calls[0][0].fields).not.toHaveProperty('requestBody');
    expect(logEvent.mock.calls[0][0].fields).not.toHaveProperty('responseBody');
  });
});

describe('desktop auth reset', () => {
  it('clears token and records login notice when API returns 401', async () => {
    setToken('expired-token');
    const listener = vi.fn();
    const unsubscribe = subscribeSession(listener);

    expect(() => mockedHttp.__handlers.responseError({
      response: {
        status: 401,
        headers: {},
        data: { code: 40100, message: '未登录' },
      },
      message: 'Request failed',
    })).toThrow(ApiError);

    expect(getToken()).toBeNull();
    expect(getLoginNotice()).toBe('登录状态异常，请重新登录');
    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
  });

  it('clears token and records login notice when API asks auth reset', async () => {
    setToken('expired-token');

    expect(() => mockedHttp.__handlers.responseError({
      response: {
        status: 200,
        headers: { 'x-auth-reset': '1' },
        data: { code: 40110, message: 'token 已失效' },
      },
      message: 'Request failed',
    })).toThrow(ApiError);

    expect(getToken()).toBeNull();
    expect(getLoginNotice()).toBe('登录状态异常，请重新登录');
  });

  it('clears token and records login notice when API envelope has auth code', () => {
    setToken('expired-token');

    expect(() => mockedHttp.__handlers.responseSuccess({
      data: { code: 40100, message: '未登录', data: null },
    })).toThrow(ApiError);

    expect(getToken()).toBeNull();
    expect(getLoginNotice()).toBe('登录状态异常，请重新登录');
  });

  it('clears token and records service notice when API is unreachable while logged in', () => {
    setToken('expired-token');

    expect(() => mockedHttp.__handlers.responseError({
      code: 'ERR_NETWORK',
      message: 'Network Error',
    })).toThrow('Network Error');

    expect(getToken()).toBeNull();
    expect(getLoginNotice()).toBe('服务异常，请稍后重试');
  });

  it('clears token and records service notice when API times out while logged in', () => {
    setToken('expired-token');

    expect(() => mockedHttp.__handlers.responseError({
      code: 'ECONNABORTED',
      message: 'timeout of 15000ms exceeded',
    })).toThrow('timeout of 15000ms exceeded');

    expect(getToken()).toBeNull();
    expect(getLoginNotice()).toBe('服务异常，请稍后重试');
  });

  it('maps raw network errors to service notice', () => {
    expect(toSessionNotice({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    })).toBe('服务异常，请稍后重试');
  });

  it('maps non-service errors to auth notice', () => {
    expect(toSessionNotice(new Error('token invalid'))).toBe('登录状态异常，请重新登录');
  });
});
