import type { CSSProperties } from 'react';
import { TOKENS } from '@/lib/tokens';

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  fontWeight: 500,
  fontSize: 12,
  color: TOKENS.text3,
  padding: '8px 10px',
  borderBottom: `1px solid ${TOKENS.border}`,
};

export const tdStyle: CSSProperties = {
  padding: '12px 10px',
  verticalAlign: 'middle',
};

export const tdEmptyStyle: CSSProperties = {
  padding: '24px 10px',
  color: TOKENS.text3,
  textAlign: 'center',
  fontSize: 12.5,
};
