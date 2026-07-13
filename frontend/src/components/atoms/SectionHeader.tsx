import type { ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';

export interface SectionHeaderProps {
  title: ReactNode;
  hint?: ReactNode;
  extra?: ReactNode;
}

export function SectionHeader({ title, hint, extra }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: 'auto' }}>{extra}</div>
    </div>
  );
}
