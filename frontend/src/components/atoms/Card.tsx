import type { CSSProperties, ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';

export interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  pad?: number;
}

export function Card({ children, style, pad = 16 }: CardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
