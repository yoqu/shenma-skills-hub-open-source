import type { ApiResponse } from '../types/api';
import { CliError, networkError } from './errors';

export interface AxiosLike {
  request: (cfg: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    responseType?: 'json' | 'arraybuffer';
    data?: unknown;
    timeout?: number;
    maxContentLength?: number;
  }) => Promise<{ status: number; data: unknown; headers?: Record<string, string> }>;
}

export interface ApiOptions {
  baseUrl: string;
  token?: string;
  axios: AxiosLike;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface Api {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  downloadBytes(path: string): Promise<Buffer>;
}

export function createApi(opts: ApiOptions): Api {
  const timeout = opts.timeoutMs ?? 30_000;
  const maxBytes = opts.maxBytes ?? 64 * 1024 * 1024;

  function headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (opts.token) h.Authorization = `Bearer ${opts.token}`;
    return h;
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let resp;
    try {
      resp = await opts.axios.request({
        method,
        url: opts.baseUrl.replace(/\/$/, '') + path,
        headers: headers(),
        data: body,
        timeout,
      });
    } catch (e) {
      const err = e as Error & { response?: { status: number; data: unknown } };
      if (err.response) {
        const envelope = err.response.data as ApiResponse<unknown> | undefined;
        const code = envelope?.code ?? err.response.status;
        const msg = envelope?.message ?? `HTTP ${err.response.status}`;
        throw new CliError(2, `server error ${code}: ${msg}`);
      }
      throw networkError(err.message ?? 'network error');
    }
    const env = resp.data as ApiResponse<T>;
    if (env && typeof env === 'object' && 'code' in env && env.code !== 0) {
      throw new CliError(2, `server error ${env.code}: ${env.message}`);
    }
    return env.data;
  }

  return {
    get: <T>(p: string) => call<T>('GET', p),
    post: <T>(p: string, body?: unknown) => call<T>('POST', p, body),
    async downloadBytes(path: string): Promise<Buffer> {
      try {
        const resp = await opts.axios.request({
          method: 'GET',
          url: opts.baseUrl.replace(/\/$/, '') + path,
          headers: { ...headers(), Accept: 'application/zip, application/octet-stream' },
          responseType: 'arraybuffer',
          timeout,
          maxContentLength: maxBytes,
        });
        const data = resp.data;
        if (Buffer.isBuffer(data)) return data;
        if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
        if (data instanceof Uint8Array) return Buffer.from(data);
        throw new Error('unexpected download body type');
      } catch (e) {
        const err = e as Error & { response?: { status: number } };
        if (err.response) {
          throw new CliError(2, `download failed: HTTP ${err.response.status}`);
        }
        throw networkError(err.message ?? 'download failed');
      }
    },
  };
}
