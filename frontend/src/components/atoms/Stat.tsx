import type { ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';

export interface StatProps {
  label: string;
  value: ReactNode;
  accent?: boolean;
  delta?: ReactNode;
  icon?: ReactNode;
}

export function Stat({ label, value, accent, delta, icon }: StatProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: TOKENS.text2,
        }}
      >
        <span>{label}</span>
        {icon && <span style={{ color: TOKENS.text3 }}>{icon}</span>}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: -0.5,
          color: accent ? TOKENS.primary : TOKENS.text,
        }}
      >
        {value}
      </div>
      {delta && <div style={{ fontSize: 11, color: TOKENS.success }}>{delta}</div>}
    </div>
  );
}
