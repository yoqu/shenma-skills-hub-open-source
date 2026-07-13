import type { ReactNode } from 'react';
import { TOKENS } from '../tokens';

export interface SectionHeaderProps {
  title: ReactNode;
  hint?: ReactNode;
  extra?: ReactNode;
}

export function SectionHeader({ title, hint, extra }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 3 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: 'auto' }}>{extra}</div>
    </div>
  );
}
