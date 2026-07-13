import type { ReactNode } from 'react';
import { TOKENS } from '../tokens';

interface FormErrorProps {
  /** 推荐用法：通过 message 显式传值。 */
  message?: ReactNode;
  /** 兼容旧用法 `<FormError>...</FormError>`。 */
  children?: ReactNode;
  type?: 'error' | 'hint';
  /** Optional ID so an input can reference this message via `aria-describedby` (A11Y-001). */
  id?: string;
}

/**
 * Inline form-field message. For type=error it advertises itself to assistive
 * tech as `role="alert"` so screen readers announce validation failures
 * the moment they appear.
 */
export function FormError({ message, children, type = 'error', id }: FormErrorProps) {
  const body = message ?? children;
  if (!body) return null;
  const isError = type === 'error';
  return (
    <div
      id={id}
      role={isError ? 'alert' : undefined}
      aria-live={isError ? 'polite' : undefined}
      style={{
        fontSize: 11.5,
        color: isError ? TOKENS.danger : TOKENS.text3,
        marginTop: 4,
        lineHeight: 1.5,
      }}
    >
      {body}
    </div>
  );
}
