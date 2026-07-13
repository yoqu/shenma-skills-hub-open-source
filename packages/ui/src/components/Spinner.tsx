import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

export interface SpinnerProps {
  size?: number;
  label?: string;
  style?: CSSProperties;
}

export function Spinner({ size = 18, label = '加载中', style }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${TOKENS.borderSoft}`,
        borderTopColor: TOKENS.primary,
        borderRadius: '50%',
        animation: 'sk-spin 0.6s linear infinite',
        ...style,
      }}
    />
  );
}
