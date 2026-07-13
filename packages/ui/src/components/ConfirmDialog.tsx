import { useEffect, useId, type ReactNode } from 'react';
import { TOKENS } from '../tokens';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  confirmAriaLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  confirmAriaLabel,
  cancelLabel = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open || loading) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  function closeOnBackdropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!loading && event.target === event.currentTarget) {
      onCancel();
    }
  }

  return (
    <div style={backdropStyle} onPointerDown={closeOnBackdropPointerDown}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        style={dialogStyle}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div style={bodyStyle}>
          <h2 id={titleId} style={titleStyle}>{title}</h2>
          {description && <p id={descriptionId} style={descriptionStyle}>{description}</p>}
        </div>

        <div style={footerStyle}>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            aria-label={confirmAriaLabel}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'rgba(15, 23, 42, .38)',
};

const dialogStyle: React.CSSProperties = {
  width: 'min(420px, calc(100vw - 32px))',
  overflow: 'hidden',
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 12,
  background: TOKENS.bg,
  boxShadow: '0 16px 48px rgba(15, 23, 42, .18)',
};

const bodyStyle: React.CSSProperties = {
  padding: '20px 20px 0',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: TOKENS.text,
  fontSize: 15,
  lineHeight: 1.4,
  fontWeight: 600,
};

const descriptionStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: TOKENS.text2,
  fontSize: 13,
  lineHeight: 1.55,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '18px 20px 20px',
};
