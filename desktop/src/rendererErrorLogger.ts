type RendererErrorKind = 'runtime_error' | 'unhandled_rejection';

type RendererLogEventInput = {
  level: 'error';
  moduleName: 'skillstack_desktop::renderer';
  message: string;
  fields: {
    kind: RendererErrorKind;
    route: string;
    stack?: string;
    requestId?: string;
  };
};

const maxStackLength = 12 * 1024;

export function registerRendererErrorLogger(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.onerror = (message, _source, _lineno, _colno, error) => {
    void logWindowError(String(message || 'renderer runtime error'), error);
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    void logUnhandledRejection(event.reason);
  });
}

export async function logWindowError(message: string, error: unknown): Promise<void> {
  await sendRendererRuntimeLog(buildRendererRuntimeLogPayload('runtime_error', message, error));
}

export async function logUnhandledRejection(reason: unknown): Promise<void> {
  const message = extractErrorMessage(reason, 'renderer unhandled rejection');
  await sendRendererRuntimeLog(buildRendererRuntimeLogPayload('unhandled_rejection', message, reason));
}

function buildRendererRuntimeLogPayload(kind: RendererErrorKind, message: string, error: unknown): RendererLogEventInput {
  return {
    level: 'error',
    moduleName: 'skillstack_desktop::renderer',
    message,
    fields: {
      kind,
      route: getCurrentRoute(),
      stack: summarizeStack(error),
      requestId: extractRequestId(error),
    },
  };
}

async function sendRendererRuntimeLog(payload: RendererLogEventInput): Promise<void> {
  const logEvent = typeof window === 'undefined' ? undefined : window.skillstackDesktop?.logEvent;
  if (!logEvent) {
    return;
  }

  try {
    await logEvent(payload);
  } catch {
    // Renderer diagnostics must never affect the visible app flow.
  }
}

function getCurrentRoute(): string {
  if (typeof window === 'undefined' || !window.location) {
    return '';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function summarizeStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack.length > maxStackLength ? error.stack.slice(0, maxStackLength) : error.stack;
  }

  return undefined;
}

function extractRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const requestId = (error as { requestId?: unknown }).requestId;
  return typeof requestId === 'string' && requestId.trim() ? requestId.trim() : undefined;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
}
