import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_SKILLSTACK_API_URL || 'http://localhost:8080');

type DesktopApiRequestInput = {
  apiBaseUrl?: string;
  method?: string;
  url: string;
  params?: unknown;
  headers?: Record<string, string>;
  body?: unknown;
  requestId?: string;
};

type ApiRequestMetadata = {
  requestId?: string;
  startedAt?: number;
  desktopProxyLoggedFailure?: boolean;
};

type ApiRequestConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata?: ApiRequestMetadata;
};

export const http = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  adapter: createDesktopAwareAdapter(),
});

export function normalizeApiBaseUrl(value: string): string {
  const fallback = 'http://localhost:8080/api';
  const raw = value.trim();

  if (!raw) {
    return fallback;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fallback;
    }

    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    if (!url.pathname.endsWith('/api')) {
      url.pathname = `${url.pathname}/api`.replace(/\/{2,}/g, '/');
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export function setApiBaseUrl(value: string): string {
  const next = normalizeApiBaseUrl(value);
  http.defaults.baseURL = next;
  return next;
}

export function resolveApiAssetUrl(value: string): string {
  if (value.startsWith('file://')) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const key = url.pathname.replace(/^\/+/, '');
    if (!key.startsWith('uploads/') && isStorageKeyPath(key)) {
      url.pathname = `/uploads/${key}`;
      return url.toString();
    }
    return value;
  }

  const apiBaseUrl = http.defaults.baseURL || '';
  const origin = apiBaseUrl.replace(/\/api\/?$/, '');
  const key = value.replace(/^\/+/, '');
  const normalizedValue = key.startsWith('uploads/') ? `/${key}` : `/uploads/${key}`;

  return `${origin}${normalizedValue}`;
}

export function resolveSkillDownloadUrl(slug: string, version?: string | null): string {
  const apiBaseUrl = (http.defaults.baseURL || '').replace(/\/$/, '');
  const versionQuery = version ? `?version=${encodeURIComponent(version)}` : '';
  return `${apiBaseUrl}/skills/${encodeURIComponent(slug)}/download${versionQuery}`;
}

function isStorageKeyPath(value: string): boolean {
  return value.startsWith('skill-versions/')
    || value.startsWith('skill-icons/')
    || value.startsWith('skill-desc/')
    || value.startsWith('avatars/')
    || value.startsWith('teams/')
    || value.startsWith('prompt-icons/')
    || value.startsWith('branding/');
}

const TOKEN_KEY = 'skillstack.jwt';
const LOGIN_NOTICE_KEY = 'skillstack.login.notice';
const AUTH_RESET_NOTICE = '登录状态异常，请重新登录';
const SERVICE_ERROR_NOTICE = '服务异常，请稍后重试';
const sessionListeners = new Set<(token: string | null) => void>();
let apiRequestSequence = 0;

export type SessionResetReason = 'auth' | 'service';

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  notifySessionListeners(token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getLoginNotice(): string | null {
  return localStorage.getItem(LOGIN_NOTICE_KEY);
}

export function consumeLoginNotice(): string | null {
  const notice = getLoginNotice();
  localStorage.removeItem(LOGIN_NOTICE_KEY);
  return notice;
}

export function subscribeSession(listener: (token: string | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export function resetSession(reason: SessionResetReason) {
  const message = reason === 'service' ? SERVICE_ERROR_NOTICE : AUTH_RESET_NOTICE;
  setToken(null);
  localStorage.setItem(LOGIN_NOTICE_KEY, message);
}

export function toSessionNotice(error: unknown): string {
  return isServiceError(error) ? SERVICE_ERROR_NOTICE : AUTH_RESET_NOTICE;
}

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  const configWithMetadata = config as ApiRequestConfigWithMetadata;
  configWithMetadata.metadata = {
    ...configWithMetadata.metadata,
    requestId: configWithMetadata.metadata?.requestId || createApiRequestId(),
    startedAt: Date.now(),
  };
  return config;
});

export interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

http.interceptors.response.use(
  (res): any => {
    const env = res.data as ApiEnvelope<unknown>;
    if (env && typeof env === 'object' && 'code' in env) {
      if (env.code === 0 || env.code === 200) return env.data;
      if (isAuthResetCode(env.code)) {
        resetSession('auth');
      }
      logRendererApiFailure(res.config, {
        status: res.status,
        envelopeCode: env.code,
        responseBody: res.data,
      });
      throw new ApiError(env.code, env.message || 'Request failed');
    }
    return res.data;
  },
  (err: AxiosError<ApiEnvelope<unknown>>) => {
    const headerReset = err.response?.headers?.['x-auth-reset'];
    const env = err.response?.data;
    const code = env && typeof env === 'object' && 'code' in env ? env.code : undefined;
    if (headerReset === '1' || isAuthResetCode(code) || err.response?.status === 401) {
      resetSession('auth');
    } else if (isServiceError(err) && getToken()) {
      resetSession('service');
    }
    logRendererApiFailure(err.config, {
      status: err.response?.status,
      envelopeCode: code,
      responseBody: err.response?.data,
      errorCode: err.code,
      errorMessage: err.message,
    });
    if (env && typeof env === 'object' && 'code' in env) {
      throw new ApiError(env.code, env.message || err.message);
    }
    throw err;
  },
);

function isAuthResetCode(code: unknown): boolean {
  return code === 40100 || code === 40110;
}

function isServiceError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

function notifySessionListeners(token: string | null) {
  for (const listener of sessionListeners) {
    listener(token);
  }
}

function createApiRequestId(): string {
  apiRequestSequence += 1;
  return `api_${Date.now()}_${apiRequestSequence}`;
}

export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

function createDesktopAwareAdapter(): AxiosAdapter {
  const defaultAdapter = typeof axios.getAdapter === 'function'
    ? axios.getAdapter(axios.defaults.adapter)
    : undefined;

  return async (config) => {
    const desktopApi = typeof window === 'undefined' ? undefined : window.skillstackDesktop;
    if (!desktopApi?.apiRequest) {
      if (!defaultAdapter) {
        throw createDesktopNetworkError('Default axios adapter is unavailable.', 'ERR_ADAPTER_UNAVAILABLE', config);
      }
      return defaultAdapter(config);
    }

    const request = await toDesktopApiRequest(config);
    const result = await desktopApi.apiRequest(request);
    if (!result.ok) {
      throw createDesktopNetworkError(result.error.message, result.error.code, config);
    }

    const configWithMetadata = config as ApiRequestConfigWithMetadata;
    configWithMetadata.metadata = {
      ...configWithMetadata.metadata,
      desktopProxyLoggedFailure: isDesktopProxyFailure(result.data.status, result.data.data),
    };

    const response: AxiosResponse = {
      data: result.data.data,
      status: result.data.status,
      statusText: result.data.statusText,
      headers: result.data.headers,
      config,
      request,
    };

    if (!config.validateStatus || config.validateStatus(response.status)) {
      return response;
    }

    throw createDesktopResponseError(response, config);
  };
}

async function toDesktopApiRequest(config: InternalAxiosRequestConfig): Promise<DesktopApiRequestInput> {
  const configWithMetadata = config as ApiRequestConfigWithMetadata;
  return {
    apiBaseUrl: config.baseURL,
    method: (config.method || 'GET').toUpperCase(),
    url: config.url || '/',
    headers: headersToRecord(config.headers),
    params: config.params,
    body: await serializeDesktopRequestBody(config.data),
    requestId: configWithMetadata.metadata?.requestId,
  };
}

function headersToRecord(headers: unknown): Record<string, string> {
  const source = normalizeHeaderSource(headers);
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    result[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  return result;
}

function normalizeHeaderSource(headers: unknown): Record<string, unknown> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const value = headers as { toJSON?: () => Record<string, unknown> };
  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  return headers as Record<string, unknown>;
}

async function serializeDesktopRequestBody(data: unknown): Promise<unknown> {
  if (!isFormData(data)) {
    return data;
  }

  const entries = [];
  for (const [name, value] of data.entries()) {
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      const file = value as Blob & { name?: string };
      entries.push({
        name,
        fileName: typeof file.name === 'string' ? file.name : 'blob',
        mimeType: file.type || 'application/octet-stream',
        data: await file.arrayBuffer(),
      });
    } else {
      entries.push({
        name,
        value,
      });
    }
  }

  return {
    kind: 'formData',
    entries,
  };
}

function isFormData(data: unknown): data is FormData {
  return typeof FormData !== 'undefined' && data instanceof FormData;
}

function createDesktopNetworkError(message: string, code: string, config: InternalAxiosRequestConfig): AxiosError {
  return {
    name: 'AxiosError',
    message,
    code,
    config,
    isAxiosError: true,
    toJSON: () => ({ message, code }),
  } as AxiosError;
}

function createDesktopResponseError(response: AxiosResponse, config: InternalAxiosRequestConfig): AxiosError {
  const message = `Request failed with status code ${response.status}`;
  return {
    name: 'AxiosError',
    message,
    code: 'ERR_BAD_RESPONSE',
    config,
    request: response.request,
    response,
    isAxiosError: true,
    toJSON: () => ({ message, status: response.status }),
  } as AxiosError;
}

function logRendererApiFailure(
  config: InternalAxiosRequestConfig | undefined,
  failure: {
    status?: number;
    envelopeCode?: unknown;
    responseBody?: unknown;
    errorCode?: string;
    errorMessage?: string;
  },
): void {
  const desktopApi = typeof window === 'undefined' ? undefined : window.skillstackDesktop;
  if (!desktopApi?.logEvent || !config) {
    return;
  }

  const requestBody = getSerializableRequestBodyForLog(config.data);
  if (requestBody instanceof Promise) {
    void requestBody.then((body) => {
      sendRendererApiFailureLog(desktopApi.logEvent, config, failure, body);
    });
    return;
  }

  sendRendererApiFailureLog(desktopApi.logEvent, config, failure, requestBody);
}

function sendRendererApiFailureLog(
  logEvent: NonNullable<typeof window.skillstackDesktop>['logEvent'],
  config: InternalAxiosRequestConfig,
  failure: {
    status?: number;
    envelopeCode?: unknown;
    responseBody?: unknown;
    errorCode?: string;
    errorMessage?: string;
  },
  requestBody: unknown,
): void {
  const method = (config.method || 'GET').toUpperCase();
  const configWithMetadata = config as ApiRequestConfigWithMetadata;
  const mainLogged = configWithMetadata.metadata?.desktopProxyLoggedFailure === true;
  const fields: Record<string, unknown> = {
    requestId: configWithMetadata.metadata?.requestId,
    fallback: true,
    mainLogged: mainLogged || undefined,
    status: failure.status,
    envelopeCode: failure.envelopeCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    durationMs: configWithMetadata.metadata?.startedAt ? Date.now() - configWithMetadata.metadata.startedAt : undefined,
  };

  if (!mainLogged) {
    fields.requestBody = requestBody;
    fields.responseBody = failure.responseBody;
  }

  void logEvent({
    level: 'error',
    moduleName: 'skillstack_desktop::renderer_api',
    message: `${method} ${config.url || '/'} failed`,
    fields,
  });
}

function getSerializableRequestBodyForLog(data: unknown): unknown | Promise<unknown> {
  if (isFormData(data)) {
    return serializeDesktopRequestBody(data);
  }

  return data;
}

function isDesktopProxyFailure(status: number, data: unknown): boolean {
  if (status < 200 || status >= 400) {
    return true;
  }

  if (!data || typeof data !== 'object' || !('code' in data)) {
    return false;
  }

  const code = (data as { code?: unknown }).code;
  return typeof code === 'number' && code !== 0 && code !== 200;
}
