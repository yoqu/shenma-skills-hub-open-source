import type { ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';

export interface DashTopBarProps {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
}

/** 1:1 port of DashTopBar in docs/design-ui/screen-team-dash.jsx. */
export function DashTopBar({ title, hint, actions }: DashTopBarProps) {
  return (
    <div
      style={{
        height: 56,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${TOKENS.border}`,
        background: '#fff',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        {hint && <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {actions}
      </div>
    </div>
  );
}
