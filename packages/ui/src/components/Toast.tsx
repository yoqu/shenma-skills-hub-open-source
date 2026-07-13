import { useEffect, useState } from 'react';
import { TOKENS } from '../tokens';
import { I } from '../icons';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  kind?: ToastKind;
  message: string;
  /** auto-dismiss in ms; default 3500 */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastPayload, 'kind' | 'message'>> {
  id: number;
  duration: number;
}

const KIND_STYLE: Record<
  ToastKind,
  { bg: string; border: string; iconColor: string; Icon: typeof I.check }
> = {
  success: { bg: '#F0FDF4', border: '#86EFAC', iconColor: TOKENS.success, Icon: I.check },
  error: { bg: '#FEF2F2', border: '#FECACA', iconColor: TOKENS.danger, Icon: I.x },
  warning: { bg: '#FFFBEB', border: '#FCD34D', iconColor: TOKENS.warning, Icon: I.shield },
  info: { bg: '#EFF6FF', border: '#BFDBFE', iconColor: TOKENS.info, Icon: I.bell },
};

let counter = 0;

/** Fire a toast from anywhere — works inside or outside React. */
export function toast(payload: ToastPayload | string) {
  const detail: ToastPayload =
    typeof payload === 'string' ? { kind: 'success', message: payload } : payload;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail }));
}

/**
 * Mount once near the root. Listens to `app:toast` CustomEvent and renders a stack
 * of dismissable toasts at the top-right.
 */
export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ToastPayload>;
      const raw = ce.detail;
      if (!raw || !raw.message) return;
      const id = ++counter;
      const item: ToastItem = {
        id,
        kind: raw.kind ?? 'success',
        message: raw.message,
        duration: raw.duration ?? 3500,
      };
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, item.duration);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="通知"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {items.map((t) => {
        const s = KIND_STYLE[t.kind];
        const Icon = s.Icon;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              minWidth: 240,
              maxWidth: 380,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(15,23,42,.08)',
              fontSize: 12.5,
              color: TOKENS.text,
              animation: 'toast-in .18s ease-out',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                background: '#fff',
                display: 'grid',
                placeItems: 'center',
                color: s.iconColor,
                flex: '0 0 auto',
                marginTop: 1,
              }}
            >
              <Icon size={12} />
            </div>
            <div style={{ flex: 1, lineHeight: 1.5, wordBreak: 'break-word' }}>{t.message}</div>
            <button
              type="button"
              aria-label="关闭通知"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: TOKENS.text3,
                padding: 2,
                marginTop: -2,
              }}
            >
              <I.x size={12} />
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toast-in{from{transform:translateX(12px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}
