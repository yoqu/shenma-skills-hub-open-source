import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

export interface DividerProps {
  vertical?: boolean;
  color?: string;
  style?: CSSProperties;
}

export function Divider({ vertical, color = TOKENS.borderSoft, style }: DividerProps) {
  if (vertical) {
    return <div style={{ width: 1, alignSelf: 'stretch', background: color, ...style }} />;
  }
  return <div style={{ height: 1, width: '100%', background: color, ...style }} />;
}
