import {
  serializeErrorForLog,
  summarizeBodyForLog,
  type DesktopLogger,
  type LogFields,
} from './logger';

export type ApiProxyRequest = {
  apiBaseUrl?: string;
  method?: string;
  url?: string;
  params?: unknown;
  headers?: Record<string, unknown>;
  body?: unknown;
};

export type ApiProxyResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
};

type SerializedFormDataBody = {
  kind: 'formData';
  entries: SerializedFormDataEntry[];
};

type SerializedFormDataEntry = {
  name: string;
  value: string;
} | {
  name: string;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
};

type Fetcher = (input: URL, init: RequestInit) => Promise<Response>;

type ApiProxyLogContext = {
  logger?: DesktopLogger;
  requestId?: string;
};

const defaultApiBaseUrl = 'http://localhost:8080';
const slowApiThresholdMs = 3000;

export async function proxyApiRequest(
  input: unknown,
  settingsApiBaseUrl = defaultApiBaseUrl,
  fetcher: Fetcher = fetch,
  logContext: ApiProxyLogContext = {},
): Promise<ApiProxyResponse> {
  const request = normalizeApiProxyRequest(input);
  const url = buildApiProxyUrl(request, settingsApiBaseUrl);
  const method = normalizeMethod(request.method);
  const headers = normalizeHeaders(request.headers);
  const body = createRequestBody(request.body);
  const startedAt = Date.now();

  if (body instanceof FormData) {
    delete headers['content-type'];
    delete headers['Content-Type'];
  }

  let response: Response;
  try {
    response = await fetcher(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
    });
  } catch (error) {
    logApiFailure(logContext, {
      request,
      method,
      url,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }

  const proxyResponse = await createApiProxyResponse(response);
  const durationMs = Date.now() - startedAt;
  if (isFailedApiResponse(proxyResponse)) {
    logApiFailure(logContext, {
      request,
      method,
      url,
      durationMs,
      response: proxyResponse,
    });
  } else if (durationMs > slowApiThresholdMs) {
    logSlowApiRequest(logContext, {
      method,
      url,
      durationMs,
    });
  }

  return proxyResponse;
}

export function buildApiProxyUrl(request: ApiProxyRequest, settingsApiBaseUrl = defaultApiBaseUrl): URL {
  const apiBaseUrl = normalizeApiBaseUrl(request.apiBaseUrl || settingsApiBaseUrl);
  const rawPath = typeof request.url === 'string' ? request.url.trim() : '';

  if (!rawPath || /^https?:\/\//i.test(rawPath)) {
    throw new Error('INVALID_API_REQUEST_URL');
  }

  const relativePath = rawPath.replace(/^\/+/, '');
  const url = new URL(relativePath, `${apiBaseUrl}/`);
  for (const [key, value] of serializeProxyQueryParams(request.params)) {
    url.searchParams.append(key, value);
  }

  return url;
}

export async function createApiProxyResponse(response: Response): Promise<ApiProxyResponse> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const text = await response.text();
  const contentType = headers['content-type'] || '';
  const data = contentType.includes('application/json') && text ? JSON.parse(text) : text || null;

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    data,
  };
}

export function serializeProxyQueryParams(params: unknown): Array<[string, string]> {
  if (!params) {
    return [];
  }

  if (params instanceof URLSearchParams) {
    return Array.from(params.entries()).filter(([, value]) => value !== '');
  }

  if (Array.isArray(params)) {
    return params
      .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length === 2)
      .flatMap(([key, value]) => serializeProxyQueryParam(String(key), value));
  }

  if (typeof params === 'object') {
    return Object.entries(params as Record<string, unknown>)
      .flatMap(([key, value]) => serializeProxyQueryParam(key, value));
  }

  return [];
}

function normalizeApiProxyRequest(input: unknown): ApiProxyRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_API_PROXY_REQUEST');
  }

  return input as ApiProxyRequest;
}

function normalizeApiBaseUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('INVALID_API_BASE_URL');
    }

    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    if (!url.pathname.endsWith('/api')) {
      url.pathname = `${url.pathname}/api`.replace(/\/{2,}/g, '/');
    }

    return url.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_API_BASE_URL') {
      throw error;
    }
    throw new Error('INVALID_API_BASE_URL');
  }
}

function normalizeMethod(method: unknown): string {
  return typeof method === 'string' && method.trim() ? method.trim().toUpperCase() : 'GET';
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    result[key] = String(value);
  }

  return result;
}

function createRequestBody(body: unknown): BodyInit | undefined {
  if (!body) {
    return undefined;
  }

  if (isSerializedFormDataBody(body)) {
    const formData = new FormData();
    for (const entry of body.entries) {
      if ('fileName' in entry) {
        formData.append(entry.name, new Blob([entry.data], { type: entry.mimeType }), entry.fileName);
      } else {
        formData.append(entry.name, entry.value);
      }
    }
    return formData;
  }

  if (typeof body === 'string' || body instanceof ArrayBuffer || body instanceof Blob || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
}

function isSerializedFormDataBody(body: unknown): body is SerializedFormDataBody {
  return Boolean(
    body
    && typeof body === 'object'
    && (body as SerializedFormDataBody).kind === 'formData'
    && Array.isArray((body as SerializedFormDataBody).entries),
  );
}

function serializeProxyQueryParam(key: string, value: unknown): Array<[string, string]> {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => serializeProxyQueryParam(key, item));
  }

  return [[key, String(value)]];
}

function isFailedApiResponse(response: ApiProxyResponse): boolean {
  if (response.status >= 400) {
    return true;
  }

  const envelopeCode = getEnvelopeCode(response.data);
  return envelopeCode !== undefined && envelopeCode !== 0 && envelopeCode !== 200;
}

function getEnvelopeCode(data: unknown): number | undefined {
  if (!data || typeof data !== 'object' || !('code' in data)) {
    return undefined;
  }

  const code = (data as { code?: unknown }).code;
  return typeof code === 'number' ? code : undefined;
}

function logApiFailure(
  logContext: ApiProxyLogContext,
  input: {
    request: ApiProxyRequest;
    method: string;
    url: URL;
    durationMs: number;
    response?: ApiProxyResponse;
    error?: unknown;
  },
): void {
  if (!logContext.logger) {
    return;
  }

  const fields: LogFields = {
    requestId: logContext.requestId,
    status: input.response?.status,
    envelopeCode: input.response ? getEnvelopeCode(input.response.data) : undefined,
    durationMs: input.durationMs,
  };

  if (input.request.body !== undefined && input.method !== 'GET' && input.method !== 'HEAD') {
    const requestBody = summarizeBodyForLog(input.request.body);
    fields.requestBody = requestBody.text;
    fields.requestBodyTruncated = requestBody.truncated || undefined;
    fields.requestBodyOriginalLength = requestBody.truncated ? requestBody.originalLength : undefined;
  }

  if (input.response) {
    const responseBody = summarizeBodyForLog(input.response.data);
    fields.responseBody = responseBody.text;
    fields.responseBodyTruncated = responseBody.truncated || undefined;
    fields.responseBodyOriginalLength = responseBody.truncated ? responseBody.originalLength : undefined;
  }

  if (input.error) {
    fields.error = serializeErrorForLog(input.error);
  }

  logContext.logger.error(
    'skillstack_desktop::api',
    `${input.method} ${input.url.pathname} failed`,
    fields,
  );
}

function logSlowApiRequest(
  logContext: ApiProxyLogContext,
  input: {
    method: string;
    url: URL;
    durationMs: number;
  },
): void {
  if (!logContext.logger) {
    return;
  }

  logContext.logger.warn('skillstack_desktop::api', 'slow API request', {
    requestId: logContext.requestId,
    method: input.method,
    path: input.url.pathname,
    durationMs: input.durationMs,
    thresholdMs: slowApiThresholdMs,
  });
}
