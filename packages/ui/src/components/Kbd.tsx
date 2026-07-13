import type { ReactNode } from 'react';
import { TOKENS } from '../tokens';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: 11,
        padding: '1px 5px',
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderBottomWidth: 2,
        borderRadius: 4,
        color: TOKENS.text2,
      }}
    >
      {children}
    </span>
  );
}
