import axios, { AxiosError } from 'axios';

/** Axios instance. Dev: `/api/*` proxied to backend by Vite. */
export const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'skillstack.jwt';
// "Remember me" longevity — 后端在 long=true 时签发 7d token，否则签发短期（4h）token。
const REMEMBER_KEY = 'skillstack.remember';

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setRememberFlag(v: boolean) {
  if (v) localStorage.setItem(REMEMBER_KEY, '1');
  else localStorage.removeItem(REMEMBER_KEY);
}
export function getRememberFlag(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === '1';
}

http.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t && cfg.headers) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

/** Listeners notified whenever the backend tells us our token is no longer valid. */
type AuthResetListener = () => void;
const authResetListeners = new Set<AuthResetListener>();
export function onAuthReset(fn: AuthResetListener): () => void {
  authResetListeners.add(fn);
  return () => authResetListeners.delete(fn);
}
function triggerAuthReset() {
  setToken(null);
  setRememberFlag(false);
  for (const fn of authResetListeners) {
    try { fn(); } catch { /* swallow */ }
  }
}

/** Unwrap `{code, message, data}` and surface backend errors as Error. */
http.interceptors.response.use(
  (res): any => {
    const env = res.data as ApiEnvelope<unknown>;
    if (env && typeof env === 'object' && 'code' in env) {
      if (env.code === 0 || env.code === 200) return env.data;
      throw new ApiError(env.code, env.message || 'Request failed');
    }
    return res;
  },
  (err: AxiosError<ApiEnvelope<unknown>>) => {
    // Fail-closed: 后端识别为坏 token / 已过期时，清掉本地 token 并通知监听者。
    const headerReset = err.response?.headers?.['x-auth-reset'];
    const env = err.response?.data;
    const code = env && typeof env === 'object' && 'code' in env ? (env as { code: number }).code : undefined;
    if (headerReset === '1' || code === 40110 || err.response?.status === 401) {
      if (getToken()) triggerAuthReset();
    }
    if (env && typeof env === 'object' && 'code' in env) {
      throw new ApiError(env.code as number, env.message || err.message);
    }
    throw err;
  },
);

export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
